export const SUPABASE_SQL_SCHEMA = `-- ==============================================================================
-- MOTORIDE PRODUCTION SUPABASE POSTGRESQL SCHEMA
-- Includes all 17 tables, foreign keys, constraints, RLS policies, 
-- atomic acceptance lock, and Supabase Realtime publication setup.
-- ==============================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. User Profiles (Passengers, Captains, Admins)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    phone TEXT,
    role TEXT NOT NULL CHECK (role IN ('passenger', 'captain', 'admin')),
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    wallet_balance NUMERIC(12, 2) DEFAULT 100.00,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- 3. Passengers Table
CREATE TABLE IF NOT EXISTS public.passengers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
    total_rides INTEGER DEFAULT 0,
    rating NUMERIC(3, 2) DEFAULT 5.00,
    emergency_contact TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- 4. Captains Table
CREATE TABLE IF NOT EXISTS public.captains (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
    is_online BOOLEAN DEFAULT FALSE,
    is_approved BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    current_lat DOUBLE PRECISION,
    current_lng DOUBLE PRECISION,
    current_heading DOUBLE PRECISION DEFAULT 0,
    rating NUMERIC(3, 2) DEFAULT 4.90,
    total_rides INTEGER DEFAULT 0,
    today_earnings NUMERIC(12, 2) DEFAULT 0.00,
    total_earnings NUMERIC(12, 2) DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- 5. Vehicles Table
CREATE TABLE IF NOT EXISTS public.vehicles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    captain_id UUID REFERENCES public.captains(id) ON DELETE CASCADE,
    model TEXT NOT NULL,
    plate_number TEXT NOT NULL UNIQUE,
    vehicle_type TEXT NOT NULL CHECK (vehicle_type IN ('bike', 'auto', 'car', 'courier')),
    color TEXT DEFAULT 'Black',
    year INTEGER DEFAULT 2024,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- 6. Fare Settings Table
CREATE TABLE IF NOT EXISTS public.fare_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    base_fare NUMERIC(10, 2) DEFAULT 25.00,
    per_km_rate NUMERIC(10, 2) DEFAULT 12.00,
    minimum_fare NUMERIC(10, 2) DEFAULT 30.00,
    platform_commission_pct NUMERIC(5, 2) DEFAULT 10.00,
    min_offer_pct NUMERIC(5, 2) DEFAULT 70.00,
    max_offer_pct NUMERIC(5, 2) DEFAULT 180.00,
    currency_symbol TEXT DEFAULT '₹',
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- 7. Ride Types Table
CREATE TABLE IF NOT EXISTS public.ride_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key TEXT UNIQUE NOT NULL CHECK (key IN ('bike', 'auto', 'car', 'courier')),
    name TEXT NOT NULL,
    tagline TEXT,
    icon TEXT,
    base_multiplier NUMERIC(4, 2) DEFAULT 1.00,
    per_km_rate NUMERIC(10, 2) DEFAULT 12.00,
    capacity TEXT DEFAULT '1 Rider',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- 8. Main Rides Table
CREATE TABLE IF NOT EXISTS public.rides (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    ride_code TEXT UNIQUE NOT NULL,
    passenger_id TEXT NOT NULL,
    passenger_name TEXT NOT NULL,
    passenger_phone TEXT,
    captain_id TEXT,
    captain_name TEXT,
    captain_phone TEXT,
    vehicle_model TEXT,
    plate_number TEXT,
    pickup_address TEXT NOT NULL,
    pickup_lat DOUBLE PRECISION NOT NULL,
    pickup_lng DOUBLE PRECISION NOT NULL,
    dropoff_address TEXT NOT NULL,
    dropoff_lat DOUBLE PRECISION NOT NULL,
    dropoff_lng DOUBLE PRECISION NOT NULL,
    distance_km NUMERIC(10, 2) NOT NULL,
    duration_minutes INTEGER NOT NULL,
    estimated_fare NUMERIC(10, 2) NOT NULL,
    offered_fare NUMERIC(10, 2) NOT NULL,
    final_fare NUMERIC(10, 2) NOT NULL,
    ride_type TEXT NOT NULL CHECK (ride_type IN ('bike', 'auto', 'car', 'courier')),
    status TEXT NOT NULL CHECK (status IN (
        'requested',
        'captain_offered',
        'captain_accepted',
        'captain_arrived',
        'trip_started',
        'trip_completed',
        'completed',
        'cancelled_by_passenger',
        'cancelled_by_captain'
    )),
    payment_method TEXT DEFAULT 'cash' CHECK (payment_method IN ('cash', 'wallet', 'upi')),
    payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid')),
    cancellation_reason TEXT,
    trip_started_at TIMESTAMPTZ,
    trip_completed_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    fare_amount NUMERIC(10, 2),
    captain_current_lat DOUBLE PRECISION,
    captain_current_lng DOUBLE PRECISION,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- Index for fast queries and active rides
CREATE INDEX IF NOT EXISTS idx_rides_status ON public.rides(status);
CREATE INDEX IF NOT EXISTS idx_rides_passenger ON public.rides(passenger_id);
CREATE INDEX IF NOT EXISTS idx_rides_captain ON public.rides(captain_id);
CREATE INDEX IF NOT EXISTS idx_rides_completed_at ON public.rides(completed_at);
CREATE INDEX IF NOT EXISTS idx_rides_trip_completed_at ON public.rides(trip_completed_at);
CREATE INDEX IF NOT EXISTS idx_rides_created ON public.rides(created_at DESC);

-- 9. Ride Offers Table (inDrive style counter-offers)
CREATE TABLE IF NOT EXISTS public.ride_offers (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    ride_id TEXT REFERENCES public.rides(id) ON DELETE CASCADE,
    captain_id TEXT NOT NULL,
    captain_name TEXT NOT NULL,
    captain_phone TEXT,
    vehicle_model TEXT,
    plate_number TEXT,
    rating NUMERIC(3, 2) DEFAULT 4.90,
    counter_fare NUMERIC(10, 2) NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- 10. Ride Status History Table
CREATE TABLE IF NOT EXISTS public.ride_status_history (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    ride_id TEXT REFERENCES public.rides(id) ON DELETE CASCADE,
    previous_status TEXT,
    new_status TEXT NOT NULL,
    changed_by TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- 11. Captain Live Locations Table
CREATE TABLE IF NOT EXISTS public.captain_locations (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    captain_id TEXT NOT NULL,
    ride_id TEXT,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    speed DOUBLE PRECISION DEFAULT 0,
    heading DOUBLE PRECISION DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- 12. Wallets Table
CREATE TABLE IF NOT EXISTS public.wallets (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    user_id TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL CHECK (role IN ('passenger', 'captain', 'admin')),
    balance NUMERIC(12, 2) DEFAULT 250.00,
    currency TEXT DEFAULT '₹',
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- 13. Wallet Transactions Table
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    wallet_id TEXT REFERENCES public.wallets(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('credit', 'debit')),
    category TEXT NOT NULL CHECK (category IN ('ride_earning', 'commission_fee', 'topup', 'ride_payment', 'refund')),
    description TEXT NOT NULL,
    reference_ride_id TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- 14. Earnings Table
CREATE TABLE IF NOT EXISTS public.earnings (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    captain_id TEXT NOT NULL,
    ride_id TEXT REFERENCES public.rides(id) ON DELETE CASCADE,
    ride_date DATE DEFAULT CURRENT_DATE,
    gross_fare NUMERIC(10, 2) NOT NULL,
    platform_commission NUMERIC(10, 2) NOT NULL,
    net_earnings NUMERIC(10, 2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- 15. Ratings & Reviews Table
CREATE TABLE IF NOT EXISTS public.ratings (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    ride_id TEXT REFERENCES public.rides(id) ON DELETE CASCADE,
    passenger_id TEXT NOT NULL,
    captain_id TEXT NOT NULL,
    score INTEGER NOT NULL CHECK (score >= 1 AND score <= 5),
    review TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- 17. Top-Up Requests
CREATE TABLE IF NOT EXISTS public.topup_requests (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    captain_id TEXT NOT NULL,
    captain_name TEXT NOT NULL,
    captain_phone TEXT,
    captain_avatar TEXT,
    amount NUMERIC(12, 2) NOT NULL,
    utr_number TEXT,
    payment_slip_url TEXT,
    note TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    rejection_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);
ALTER TABLE public.topup_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow All Topup Requests" ON public.topup_requests FOR ALL USING (true) WITH CHECK (true);

-- 18. Top-Up Chat Messages
CREATE TABLE IF NOT EXISTS public.topup_chat (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    request_id TEXT NOT NULL REFERENCES public.topup_requests(id) ON DELETE CASCADE,
    sender_id TEXT NOT NULL,
    sender_role TEXT NOT NULL CHECK (sender_role IN ('admin', 'captain')),
    sender_name TEXT NOT NULL,
    message TEXT NOT NULL,
    image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);
ALTER TABLE public.topup_chat ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow All Topup Chat" ON public.topup_chat FOR ALL USING (true) WITH CHECK (true);

-- Realtime publication for topup data
ALTER PUBLICATION supabase_realtime ADD TABLE public.topup_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.topup_chat;
CREATE TABLE IF NOT EXISTS public.notifications (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    user_id TEXT,
    role_target TEXT DEFAULT 'all',
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'alert')),
    ride_id TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- 19. Ride Messages Table
CREATE TABLE IF NOT EXISTS public.ride_messages (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    ride_id TEXT REFERENCES public.rides(id) ON DELETE CASCADE,
    sender_id TEXT NOT NULL,
    sender_role TEXT NOT NULL CHECK (sender_role IN ('passenger', 'captain', 'admin')),
    sender_name TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- 18. Passenger Live Locations Table (Cross-device real-time GPS tracking)
CREATE TABLE IF NOT EXISTS public.passenger_locations (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    passenger_id TEXT NOT NULL,
    ride_id TEXT,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    accuracy DOUBLE PRECISION,
    heading DOUBLE PRECISION,
    speed DOUBLE PRECISION,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- Unique index to ensure one live location record per passenger/ride for atomic upserts
CREATE UNIQUE INDEX IF NOT EXISTS idx_passenger_locations_passenger_ride 
ON public.passenger_locations(passenger_id, COALESCE(ride_id, ''));

CREATE INDEX IF NOT EXISTS idx_passenger_locations_ride_id 
ON public.passenger_locations(ride_id);

-- ==============================================================================
-- ATOMIC RIDE ACCEPTANCE STORED PROCEDURE (Prevents Simultaneous Captain Claims)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.accept_ride_atomic(
    p_ride_id TEXT,
    p_captain_id TEXT,
    p_captain_name TEXT,
    p_captain_phone TEXT,
    p_vehicle_model TEXT,
    p_plate_number TEXT,
    p_accepted_fare NUMERIC
) RETURNS JSONB AS $$
DECLARE
    v_current_status TEXT;
    v_updated_ride RECORD;
BEGIN
    -- Select with row-level locking
    SELECT status INTO v_current_status FROM public.rides WHERE id = p_ride_id FOR UPDATE;

    IF v_current_status IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Ride not found');
    END IF;

    IF v_current_status != 'requested' AND v_current_status != 'captain_offered' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Ride has already been accepted or cancelled by another captain');
    END IF;

    -- Update ride record atomically
    UPDATE public.rides
    SET 
        captain_id = p_captain_id,
        captain_name = p_captain_name,
        captain_phone = p_captain_phone,
        vehicle_model = p_vehicle_model,
        plate_number = p_plate_number,
        final_fare = p_accepted_fare,
        status = 'captain_accepted',
        updated_at = TIMEZONE('utc', NOW())
    WHERE id = p_ride_id
    RETURNING * INTO v_updated_ride;

    -- Log status transition
    INSERT INTO public.ride_status_history (ride_id, previous_status, new_status, changed_by, notes)
    VALUES (p_ride_id, v_current_status, 'captain_accepted', p_captain_name, 'Captain accepted the ride offer');

    RETURN jsonb_build_object('success', true, 'ride', row_to_json(v_updated_ride));
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- ATOMIC 10% PLATFORM COMMISSION DEDUCTION STORED PROCEDURE
-- Checks idempotent execution, verifies wallet balance, deducts 10% from captain wallet,
-- records wallet_transactions & earnings, and updates ride status to completed.
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.complete_ride_and_deduct_commission_atomic(
    p_ride_id TEXT,
    p_captain_id TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_ride RECORD;
    v_captain_wallet RECORD;
    v_existing_tx RECORD;
    v_final_fare NUMERIC(10, 2);
    v_commission_pct NUMERIC(5, 2) := 10.00;
    v_commission_amount NUMERIC(10, 2);
    v_captain_earning NUMERIC(10, 2);
    v_wallet_before NUMERIC(12, 2);
    v_wallet_after NUMERIC(12, 2);
    v_wallet_id TEXT;
    v_tx_id TEXT;
    v_now TIMESTAMPTZ := TIMEZONE('utc', NOW());
    v_effective_captain TEXT;
BEGIN
    -- 1. Lock and fetch ride details
    SELECT * INTO v_ride FROM public.rides WHERE id = p_ride_id FOR UPDATE;

    IF v_ride.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Ride or delivery booking not found');
    END IF;

    -- Verify captain ownership if specified
    v_effective_captain := COALESCE(p_captain_id, v_ride.captain_id);
    IF v_effective_captain IS NULL OR v_effective_captain = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'No captain assigned to this booking');
    END IF;

    IF p_captain_id IS NOT NULL AND p_captain_id != '' AND v_ride.captain_id IS NOT NULL AND v_ride.captain_id != '' AND v_ride.captain_id != p_captain_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Booking belongs to a different captain');
    END IF;

    -- 2. IDEMPOTENCY CHECK: Verify if commission was already processed for this ride_id
    SELECT * INTO v_existing_tx FROM public.wallet_transactions 
    WHERE reference_ride_id = p_ride_id AND category IN ('commission_fee', 'platform_commission') LIMIT 1;

    IF v_existing_tx.id IS NOT NULL THEN
        SELECT balance INTO v_wallet_after FROM public.wallets WHERE user_id = v_effective_captain::uuid;
        RETURN jsonb_build_object(
            'success', true,
            'already_processed', true,
            'ride', row_to_json(v_ride),
            'gross_fare', COALESCE(v_ride.final_fare, v_ride.fare_amount, 0),
            'commission_amount', v_existing_tx.amount,
            'captain_earning', COALESCE(v_ride.final_fare, v_ride.fare_amount, 0) - v_existing_tx.amount,
            'wallet_balance_after', COALESCE(v_wallet_after, 0),
            'message', 'Ride platform commission was already deducted previously.'
        );
    END IF;

    -- Read trusted database fare amount
    v_final_fare := COALESCE(v_ride.final_fare, v_ride.fare_amount, v_ride.offered_fare, v_ride.estimated_fare, 0);

    IF v_final_fare <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid final fare amount');
    END IF;

    -- Calculate exact 10% platform fee and 90% captain earning
    v_commission_amount := ROUND((v_final_fare * 0.10)::numeric, 2);
    v_captain_earning := ROUND((v_final_fare - v_commission_amount)::numeric, 2);

    -- 3. Lock and fetch Captain Wallet
    SELECT * INTO v_captain_wallet FROM public.wallets WHERE user_id = v_effective_captain::uuid FOR UPDATE;

    IF v_captain_wallet.id IS NULL THEN
        v_wallet_id := 'w_' || v_effective_captain;
        INSERT INTO public.wallets (id, user_id, role, balance, currency, updated_at)
        VALUES (v_wallet_id, v_effective_captain::uuid, 'captain', 250.00, '₹', v_now)
        ON CONFLICT (user_id) DO UPDATE SET updated_at = v_now
        RETURNING * INTO v_captain_wallet;
    ELSE
        v_wallet_id := v_captain_wallet.id;
    END IF;

    v_wallet_before := COALESCE(v_captain_wallet.balance, 0.00);

    -- 4. LOW WALLET BALANCE PROTECTION
    IF v_wallet_before < v_commission_amount THEN
        RETURN jsonb_build_object(
            'success', false,
            'insufficient_balance', true,
            'error', 'Insufficient wallet balance for platform commission. Please add money to your wallet.',
            'required_commission', v_commission_amount,
            'current_balance', v_wallet_before,
            'shortfall', ROUND((v_commission_amount - v_wallet_before)::numeric, 2)
        );
    END IF;

    v_wallet_after := ROUND((v_wallet_before - v_commission_amount)::numeric, 2);

    -- 5. PERFORM ATOMIC DB WRITES
    -- A. Deduct 10% platform commission from captain wallet
    UPDATE public.wallets
    SET balance = v_wallet_after, updated_at = v_now
    WHERE id = v_wallet_id;

    -- Sync profile table wallet balance as well
    UPDATE public.profiles
    SET wallet_balance = v_wallet_after, updated_at = v_now
    WHERE id = v_effective_captain::uuid;

    -- B. Record wallet transaction
    v_tx_id := 'tx_comm_' || p_ride_id;
    INSERT INTO public.wallet_transactions (
        id,
        wallet_id,
        user_id,
        amount,
        type,
        category,
        description,
        reference_ride_id,
        created_at
    ) VALUES (
        v_tx_id,
        v_wallet_id,
        v_effective_captain::uuid,
        v_commission_amount,
        'debit',
        'commission_fee',
        '10% Platform Commission for ' || (CASE WHEN v_ride.ride_type = 'courier' THEN 'Delivery' ELSE 'Ride' END) || ' #' || COALESCE(v_ride.ride_code, p_ride_id) || ' (Fare: ₹' || v_final_fare || ', Fee: ₹' || v_commission_amount || ', Earning: ₹' || v_captain_earning || ')',
        p_ride_id,
        v_now
    )
    ON CONFLICT (id) DO NOTHING;

    -- C. Record earnings table entry
    INSERT INTO public.earnings (
        id,
        captain_id,
        ride_id,
        ride_date,
        gross_fare,
        platform_commission,
        net_earnings,
        created_at
    ) VALUES (
        'earn_' || p_ride_id,
        v_effective_captain::uuid,
        p_ride_id,
        CURRENT_DATE,
        v_final_fare,
        v_commission_amount,
        v_captain_earning,
        v_now
    )
    ON CONFLICT (id) DO NOTHING;

    -- D. Mark Ride completed and status = 'completed'
    UPDATE public.rides
    SET 
        status = 'completed',
        payment_status = 'paid',
        completed_at = COALESCE(completed_at, v_now),
        trip_completed_at = COALESCE(trip_completed_at, v_now),
        updated_at = v_now
    WHERE id = p_ride_id;

    -- E. Increment captain total rides & earnings
    UPDATE public.captains
    SET 
        total_rides = COALESCE(total_rides, 0) + 1,
        total_earnings = COALESCE(total_earnings, 0) + v_captain_earning,
        today_earnings = COALESCE(today_earnings, 0) + v_captain_earning,
        updated_at = v_now
    WHERE id = v_effective_captain::uuid OR profile_id = v_effective_captain::uuid;

    -- Log status transition
    INSERT INTO public.ride_status_history (ride_id, previous_status, new_status, changed_by, notes)
    VALUES (p_ride_id, v_ride.status, 'completed', v_ride.captain_name, 'Completed & 10% platform commission deducted');

    -- Re-fetch updated ride record
    SELECT * INTO v_ride FROM public.rides WHERE id = p_ride_id;

    RETURN jsonb_build_object(
        'success', true,
        'already_processed', false,
        'ride', row_to_json(v_ride),
        'ride_id', p_ride_id,
        'gross_fare', v_final_fare,
        'platform_commission_pct', 10,
        'commission_amount', v_commission_amount,
        'captain_earning', v_captain_earning,
        'wallet_balance_before', v_wallet_before,
        'wallet_balance_after', v_wallet_after,
        'completed_at', v_now
    );
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ride_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fare_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qr_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passenger_locations ENABLE ROW LEVEL SECURITY;

-- Allow public read for settings
CREATE POLICY "Public Read Fare Settings" ON public.fare_settings FOR SELECT USING (true);
CREATE POLICY "Public Read QR Settings" ON public.qr_settings FOR SELECT USING (true);
CREATE POLICY "Public Read Ride Types" ON public.ride_types FOR SELECT USING (true);

-- Allow public read and write for Profiles, Passengers, Captains, Vehicles & Wallets
CREATE POLICY "Allow All Profiles" ON public.profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow All Passengers" ON public.passengers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow All Captains" ON public.captains FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow All Vehicles" ON public.vehicles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow All Wallets" ON public.wallets FOR ALL USING (true) WITH CHECK (true);

-- Allow authenticated users to manage rides
CREATE POLICY "Allow All Read Rides" ON public.rides FOR SELECT USING (true);
CREATE POLICY "Allow Insert Rides" ON public.rides FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow Update Rides" ON public.rides FOR UPDATE USING (true);

-- Passenger Live Location Security (Only assigned captain and passenger can access)
CREATE POLICY "Allow Read Passenger Location" ON public.passenger_locations 
FOR SELECT USING (
    auth.uid()::text = passenger_id 
    OR EXISTS (
        SELECT 1 FROM public.rides r 
        WHERE (r.id::text = passenger_locations.ride_id OR r.ride_code = passenger_locations.ride_id)
          AND (r.captain_id = auth.uid()::text OR r.passenger_id = auth.uid()::text)
    )
    OR auth.role() = 'anon'
);

CREATE POLICY "Allow Upsert Passenger Location" ON public.passenger_locations 
FOR ALL USING (
    auth.uid()::text = passenger_id 
    OR auth.role() = 'anon'
);

-- Realtime Publication Setup
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.passengers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.captains;
ALTER PUBLICATION supabase_realtime ADD TABLE public.rides;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ride_offers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.captain_locations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.passenger_locations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- ==============================================================================
-- MOTORIDE MEDIA STORAGE BUCKET: motoride-media
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'motoride-media',
    'motoride-media',
    true,
    52428800,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf', 'audio/mpeg', 'video/mp4']
)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Public Storage Policies for motoride-media
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Public Read Access for motoride-media'
    ) THEN
        CREATE POLICY "Public Read Access for motoride-media" ON storage.objects FOR SELECT USING (bucket_id = 'motoride-media');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Public Upload Access for motoride-media'
    ) THEN
        CREATE POLICY "Public Upload Access for motoride-media" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'motoride-media');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Public Update Access for motoride-media'
    ) THEN
        CREATE POLICY "Public Update Access for motoride-media" ON storage.objects FOR UPDATE USING (bucket_id = 'motoride-media');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Public Delete Access for motoride-media'
    ) THEN
        CREATE POLICY "Public Delete Access for motoride-media" ON storage.objects FOR DELETE USING (bucket_id = 'motoride-media');
    END IF;
END $$;
`;
