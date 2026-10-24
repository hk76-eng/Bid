import 'dotenv/config';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import {
  pricingSettings,
  updatePricingSettings,
  bikesCatalog,
  getAllRides,
  getRideById,
  saveRide,
  updateBikeAvailability,
  findUserByEmail,
  createUser,
  UserAccount,
} from './server/db';
import { backendCalculateFare, backendHaversineDistanceKm } from './server/fareEngine';
import { Ride, RideLocationHistoryItem, UserProfile } from './src/types';
import { motorideRouter } from './server/motorideRouter';

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // Universal CORS middleware for all clients (browser, mobile web, APK, Capacitor, file://)
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Range');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Support high-speed direct binary streaming for Android APK packages up to 250MB
  app.use('/api/motoride/admin/upload-apk-binary', express.raw({ type: () => true, limit: '250mb' }));
  app.use(express.json({ limit: '150mb' }));
  app.use(express.urlencoded({ extended: true, limit: '150mb' }));
  app.use(express.raw({ type: 'application/vnd.android.package-archive', limit: '250mb' }));

  // Mount Motoride Endpoints
  app.use('/api/motoride', motorideRouter);

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Auth Routes
  app.post('/api/auth/signup', (req, res) => {
    try {
      const { name, email, password, phone, preferredVehicle } = req.body;
      if (!name || !email || !password) {
        return res.status(400).json({ error: 'Name, email, and password are required' });
      }

      const existing = findUserByEmail(email);
      if (existing) {
        return res.status(409).json({ error: 'An account with this email already exists' });
      }

      const isAdminEmail = email.trim().toLowerCase() === 'freelanceseoservices01@gmail.com';
      const newUser: UserAccount = {
        id: isAdminEmail ? `USR-ADMIN-${Date.now().toString(36).toUpperCase()}` : `USR-${Date.now().toString(36).toUpperCase()}`,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password: password,
        phone: phone ? phone.trim() : undefined,
        role: isAdminEmail ? 'admin' : 'rider',
        memberSince: new Date().toISOString(),
        totalRides: 0,
        walletBalance: 100, // Welcome bonus balance
        preferredVehicle: preferredVehicle || 'PB65AA1257',
      };

      createUser(newUser);

      const profile: UserProfile = {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        phone: newUser.phone,
        role: newUser.role,
        memberSince: newUser.memberSince,
        totalRides: newUser.totalRides,
        walletBalance: newUser.walletBalance,
        preferredVehicle: newUser.preferredVehicle,
      };

      res.status(201).json({ success: true, user: profile, message: 'Account created successfully!' });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to sign up' });
    }
  });

  app.post('/api/auth/signin', (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      const user = findUserByEmail(email);
      if (!user || user.password !== password) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      const isAdminEmail = user.email.toLowerCase() === 'freelanceseoservices01@gmail.com';
      const role = isAdminEmail || user.role === 'admin' ? 'admin' : 'rider';

      const profile: UserProfile = {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role,
        memberSince: user.memberSince,
        totalRides: user.totalRides,
        walletBalance: user.walletBalance,
        preferredVehicle: user.preferredVehicle,
      };

      res.json({ success: true, user: profile, message: 'Welcome back!' });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to sign in' });
    }
  });

  app.get('/api/auth/demo', (req, res) => {
    const user = findUserByEmail('rider@travelmeter.app');
    if (user) {
      const profile: UserProfile = {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: 'rider',
        memberSince: user.memberSince,
        totalRides: user.totalRides,
        walletBalance: user.walletBalance,
        preferredVehicle: user.preferredVehicle,
      };
      res.json({ success: true, user: profile });
    } else {
      res.status(404).json({ error: 'Demo user unavailable' });
    }
  });

  app.get('/api/auth/demo-admin', (req, res) => {
    const user = findUserByEmail('freelanceseoservices01@gmail.com');
    if (user) {
      const profile: UserProfile = {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: 'admin',
        memberSince: user.memberSince,
        totalRides: user.totalRides,
        walletBalance: user.walletBalance,
        preferredVehicle: user.preferredVehicle,
      };
      res.json({ success: true, user: profile });
    } else {
      res.status(404).json({ error: 'Admin demo user unavailable' });
    }
  });

  // Settings Endpoints
  app.get('/api/settings', (req, res) => {
    res.json(pricingSettings);
  });

  const handleUpdateSettings = (req: express.Request, res: express.Response) => {
    try {
      const updated = updatePricingSettings(req.body);
      res.json({ success: true, settings: updated, ...updated });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to update settings' });
    }
  };

  app.put('/api/settings', handleUpdateSettings);
  app.post('/api/settings', handleUpdateSettings);

  // Bikes Fleet
  app.get('/api/bikes', (req, res) => {
    res.json(bikesCatalog);
  });

  // Rides List
  app.get('/api/rides', (req, res) => {
    res.json(getAllRides());
  });

  // Specific Ride Detail
  app.get('/api/rides/:id', (req, res) => {
    const ride = getRideById(req.params.id);
    if (!ride) {
      return res.status(404).json({ error: 'Ride not found' });
    }
    res.json(ride);
  });

  // Start Ride Endpoint
  app.post('/api/rides/start', (req, res) => {
    try {
      const {
        bike_id,
        passenger_id = 'USR-' + Math.floor(1000 + Math.random() * 9000),
        passenger_name = 'Hemant Kashyap',
        start_latitude,
        start_longitude,
        accuracy = 5,
        start_address,
      } = req.body || {};

      const bike =
        bikesCatalog.find((b) => b.id === bike_id) ||
        bikesCatalog[0] || {
          id: 'PB65AA1257',
          name: 'Mahindra Centuro PB65AA1257',
          type: 'Motorcycle',
          location_name: 'Origin Base Station',
          latitude: 12.971598,
          longitude: 77.594562,
          is_available: true,
          battery_level: 100,
          qr_code: 'PB65AA1257',
        };

      const safeLat =
        typeof start_latitude === 'number' && !isNaN(start_latitude)
          ? Number(start_latitude)
          : bike.latitude || 12.971598;
      const safeLng =
        typeof start_longitude === 'number' && !isNaN(start_longitude)
          ? Number(start_longitude)
          : bike.longitude || 77.594562;
      const safeAcc =
        typeof accuracy === 'number' && !isNaN(accuracy) ? Number(accuracy) : 5;

      // Generate unique ride ID
      const rideId = `RIDE-${Date.now().toString().slice(-6)}`;
      const now = new Date().toISOString();

      const initialLocation: RideLocationHistoryItem = {
        latitude: safeLat,
        longitude: safeLng,
        accuracy: safeAcc,
        timestamp: Date.now(),
        speed: 0,
        accumulatedDistanceKm: 0,
        deltaDistanceKm: 0,
      };

      const initialFare = backendCalculateFare(
        0,
        pricingSettings.rate_per_km,
        pricingSettings.base_unlock_fee,
        pricingSettings.minimum_fare
      );

      const newRide: Ride = {
        ride_id: rideId,
        passenger_id,
        passenger_name,
        bike_id: bike.id,
        bike_name: bike.name,
        bike_type: bike.type,
        status: 'STARTED',
        start_time: now,
        end_time: null,
        start_latitude: safeLat,
        start_longitude: safeLng,
        start_address:
          start_address ||
          `${bike.location_name} (GPS: ${safeLat.toFixed(4)}, ${safeLng.toFixed(4)})`,
        end_latitude: null,
        end_longitude: null,
        total_distance_km: 0.0,
        rate_per_km: pricingSettings.rate_per_km,
        base_unlock_fee: pricingSettings.base_unlock_fee,
        minimum_fare: pricingSettings.minimum_fare,
        final_fare: initialFare.totalFare,
        locations: [initialLocation],
        duration_seconds: 0,
        pause_duration_seconds: 0,
        max_speed_kmh: 0,
        avg_speed_kmh: 0,
        created_at: now,
        updated_at: now,
        payment_status: 'UNPAID',
      };

      saveRide(newRide);
      updateBikeAvailability(bike.id, false);

      res.status(201).json({
        success: true,
        message: 'Ride started successfully',
        ride: newRide,
      });
    } catch (err: any) {
      console.error('Error starting ride on server:', err);
      res.status(500).json({
        error: err.message || 'Internal error starting ride',
      });
    }
  });

  // Location update / GPS ingest with Authoritative Distance & Fare recalculation
  app.post('/api/rides/:id/location', (req, res) => {
    let ride = getRideById(req.params.id);
    const { latitude, longitude, accuracy = 5, timestamp = Date.now(), speed = 0, heading = 0, isMoving } = req.body;

    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: 'Missing coordinates' });
    }

    if (!ride) {
      // Auto-recover or instantiate active ride session on server
      const now = new Date().toISOString();
      const initialFare = backendCalculateFare(
        0,
        pricingSettings.rate_per_km,
        pricingSettings.base_unlock_fee,
        pricingSettings.minimum_fare
      );
      ride = {
        ride_id: req.params.id,
        passenger_id: 'USR-8821',
        passenger_name: 'Hemant Kashyap',
        bike_id: 'PB65AA1257',
        bike_name: 'Mahindra Centuro PB65AA1257',
        bike_type: 'Motorcycle',
        status: 'STARTED',
        start_time: now,
        end_time: null,
        start_latitude: Number(latitude),
        start_longitude: Number(longitude),
        start_address: `Base Station (GPS: ${Number(latitude).toFixed(4)}, ${Number(longitude).toFixed(4)})`,
        end_latitude: null,
        end_longitude: null,
        total_distance_km: 0.0,
        rate_per_km: pricingSettings.rate_per_km,
        base_unlock_fee: pricingSettings.base_unlock_fee,
        minimum_fare: pricingSettings.minimum_fare,
        final_fare: initialFare.totalFare,
        locations: [
          {
            latitude: Number(latitude),
            longitude: Number(longitude),
            accuracy: Number(accuracy),
            timestamp: Number(timestamp),
            speed: Number(speed),
            heading: Number(heading),
            accumulatedDistanceKm: 0,
            deltaDistanceKm: 0,
            isMoving: Boolean(isMoving),
          },
        ],
        duration_seconds: 0,
        pause_duration_seconds: 0,
        max_speed_kmh: 0,
        avg_speed_kmh: 0,
        created_at: now,
        updated_at: now,
        payment_status: 'UNPAID',
      };
      saveRide(ride);
    }

    if (ride.status === 'COMPLETED') {
      return res.status(400).json({ error: 'Cannot append location to completed ride' });
    }

    // If ride is paused, save point without accumulating distance
    if (ride.status === 'PAUSED') {
      const pausedPoint: RideLocationHistoryItem = {
        latitude: Number(latitude),
        longitude: Number(longitude),
        accuracy: Number(accuracy),
        timestamp: Number(timestamp),
        speed: 0,
        heading: Number(heading),
        accumulatedDistanceKm: ride.total_distance_km,
        deltaDistanceKm: 0,
        isFilteredOut: true,
        filterReason: 'Ride is paused',
        isMoving: false,
      };
      ride.locations.push(pausedPoint);
      saveRide(ride);
      return res.json({
        success: true,
        total_distance_km: ride.total_distance_km,
        final_fare: ride.final_fare,
        rate_per_km: ride.rate_per_km,
        deltaKm: 0,
        isFiltered: true,
        filterReason: 'Ride is paused',
      });
    }

    // Filter 1: Accuracy threshold check (allows up to 250m to support mobile & browser GPS fallback)
    const maxAccuracyLimit = Math.max(250, pricingSettings.max_gps_accuracy_threshold_m || 250);
    if (accuracy > maxAccuracyLimit) {
      return res.json({
        success: true,
        total_distance_km: ride.total_distance_km,
        final_fare: ride.final_fare,
        rate_per_km: ride.rate_per_km,
        isFiltered: true,
        filterReason: `Accuracy ${Math.round(accuracy)}m exceeds ${maxAccuracyLimit}m threshold`,
      });
    }

    const lastValidPoint = ride.locations && ride.locations.length > 0 ? ride.locations[ride.locations.length - 1] : null;
    let deltaKm = 0;
    let computedSpeedKmh = speed ? Number(speed) * 3.6 : 0;
    let safeTimestamp = Number(timestamp) || Date.now();

    if (lastValidPoint) {
      // Auto-correct non-strictly monotonic timestamps so valid moves are never discarded
      if (safeTimestamp <= Number(lastValidPoint.timestamp)) {
        safeTimestamp = Number(lastValidPoint.timestamp) + 50;
      }

      const rawDelta = backendHaversineDistanceKm(
        lastValidPoint.latitude,
        lastValidPoint.longitude,
        Number(latitude),
        Number(longitude)
      );

      const deltaMeters = rawDelta * 1000;
      const timeDiffMs = Math.max(50, safeTimestamp - Number(lastValidPoint.timestamp));
      const hours = timeDiffMs / (1000 * 60 * 60);
      const instantSpeed = hours > 0 ? rawDelta / hours : 0;
      const effectiveSpeedKmh = Math.max(computedSpeedKmh, instantSpeed);

      // Filter 2: Speed jump / GPS teleportation glitch filter (e.g. > 130 km/h with massive jump > 200m)
      if (instantSpeed > 130 && deltaMeters > 200) {
        return res.json({
          success: true,
          total_distance_km: ride.total_distance_km,
          final_fare: ride.final_fare,
          rate_per_km: ride.rate_per_km,
          deltaKm: 0,
          isFiltered: true,
          filterReason: `Speed jump (${instantSpeed.toFixed(1)} km/h > 130 km/h limit)`,
        });
      }

      // Filter 3: Motion Check - Only accumulate distance when vehicle is MOVING in active ride
      const isVehicleMoving = (isMoving !== undefined)
        ? Boolean(isMoving)
        : (effectiveSpeedKmh >= 1.0 && deltaMeters >= 1.5);

      if (!isVehicleMoving || effectiveSpeedKmh < 1.0 || deltaMeters < 1.5) {
        // Vehicle is stopped / stationary: save coordinate for path visualizer, freeze distance and fare
        const historyPoint: RideLocationHistoryItem = {
          latitude: Number(latitude),
          longitude: Number(longitude),
          accuracy: Number(accuracy),
          timestamp: safeTimestamp,
          speed: 0,
          heading: Number(heading) || 0,
          accumulatedDistanceKm: ride.total_distance_km,
          deltaDistanceKm: 0,
          isMoving: false,
        };

        ride.locations.push(historyPoint);
        ride.updated_at = new Date().toISOString();
        saveRide(ride);

        return res.json({
          success: true,
          total_distance_km: ride.total_distance_km,
          final_fare: ride.final_fare,
          rate_per_km: ride.rate_per_km,
          deltaKm: 0,
          isMoving: false,
          isFiltered: true,
          filterReason: 'Vehicle stopped - distance frozen',
        });
      }

      deltaKm = rawDelta;
      computedSpeedKmh = Math.min(130, effectiveSpeedKmh);
    }

    const newTotalDist = Number(Math.max(ride.total_distance_km, Number((ride.total_distance_km + deltaKm).toFixed(3))));
    ride.total_distance_km = newTotalDist;

    // Authoritative Fare Recalculation
    const calculatedFare = backendCalculateFare(
      newTotalDist,
      ride.rate_per_km,
      ride.base_unlock_fee,
      ride.minimum_fare
    );

    ride.final_fare = calculatedFare.totalFare;
    ride.max_speed_kmh = Math.max(ride.max_speed_kmh || 0, computedSpeedKmh);
    ride.updated_at = new Date().toISOString();

    const historyPoint: RideLocationHistoryItem = {
      latitude: Number(latitude),
      longitude: Number(longitude),
      accuracy: Number(accuracy),
      timestamp: safeTimestamp,
      speed: Number(speed) || 0,
      heading: Number(heading) || 0,
      accumulatedDistanceKm: newTotalDist,
      deltaDistanceKm: Number(deltaKm.toFixed(3)),
    };

    ride.locations.push(historyPoint);
    saveRide(ride);

    res.json({
      success: true,
      total_distance_km: ride.total_distance_km,
      final_fare: ride.final_fare,
      rate_per_km: ride.rate_per_km,
      deltaKm: Number(deltaKm.toFixed(3)),
      distanceFare: calculatedFare.distanceFare,
      baseFee: calculatedFare.baseFee,
      isFiltered: false,
    });
  });

  // Pause ride
  app.post('/api/rides/:id/pause', (req, res) => {
    let ride = getRideById(req.params.id);
    if (!ride) {
      ride = {
        ride_id: req.params.id,
        passenger_id: 'USR-8821',
        passenger_name: 'Hemant Kashyap',
        bike_id: 'PB65AA1257',
        bike_name: 'Mahindra Centuro PB65AA1257',
        bike_type: 'Motorcycle',
        status: 'PAUSED',
        start_time: new Date().toISOString(),
        end_time: null,
        start_latitude: 12.971598,
        start_longitude: 77.594562,
        start_address: 'Origin Location',
        end_latitude: null,
        end_longitude: null,
        total_distance_km: 0.0,
        rate_per_km: pricingSettings.rate_per_km,
        base_unlock_fee: pricingSettings.base_unlock_fee,
        minimum_fare: pricingSettings.minimum_fare,
        final_fare: pricingSettings.minimum_fare,
        locations: [],
        duration_seconds: 0,
        pause_duration_seconds: 0,
        max_speed_kmh: 0,
        avg_speed_kmh: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        payment_status: 'UNPAID',
      };
      saveRide(ride);
    } else {
      ride.status = 'PAUSED';
      ride.updated_at = new Date().toISOString();
      saveRide(ride);
    }
    res.json({ success: true, ride });
  });

  // Resume ride
  app.post('/api/rides/:id/resume', (req, res) => {
    let ride = getRideById(req.params.id);
    if (!ride) {
      ride = {
        ride_id: req.params.id,
        passenger_id: 'USR-8821',
        passenger_name: 'Hemant Kashyap',
        bike_id: 'PB65AA1257',
        bike_name: 'Mahindra Centuro PB65AA1257',
        bike_type: 'Motorcycle',
        status: 'STARTED',
        start_time: new Date().toISOString(),
        end_time: null,
        start_latitude: 12.971598,
        start_longitude: 77.594562,
        start_address: 'Origin Location',
        end_latitude: null,
        end_longitude: null,
        total_distance_km: 0.0,
        rate_per_km: pricingSettings.rate_per_km,
        base_unlock_fee: pricingSettings.base_unlock_fee,
        minimum_fare: pricingSettings.minimum_fare,
        final_fare: pricingSettings.minimum_fare,
        locations: [],
        duration_seconds: 0,
        pause_duration_seconds: 0,
        max_speed_kmh: 0,
        avg_speed_kmh: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        payment_status: 'UNPAID',
      };
      saveRide(ride);
    } else {
      ride.status = 'STARTED';
      ride.updated_at = new Date().toISOString();
      saveRide(ride);
    }
    res.json({ success: true, ride });
  });

  // Stop / Complete ride
  app.post('/api/rides/:id/stop', (req, res) => {
    let ride = getRideById(req.params.id);
    const {
      end_latitude = 12.971598,
      end_longitude = 77.594562,
      accuracy = 5,
      end_address,
      duration_seconds,
      total_distance_km,
      rate_per_km,
      base_unlock_fee,
      minimum_fare,
    } = req.body || {};

    const now = new Date().toISOString();
    const effectiveRate = typeof rate_per_km === 'number' ? Number(rate_per_km) : (ride?.rate_per_km || pricingSettings.rate_per_km);
    const effectiveBase = typeof base_unlock_fee === 'number' ? Number(base_unlock_fee) : (ride?.base_unlock_fee ?? pricingSettings.base_unlock_fee);
    const effectiveMin = typeof minimum_fare === 'number' ? Number(minimum_fare) : (ride?.minimum_fare ?? pricingSettings.minimum_fare);
    const clientReportedDist = typeof total_distance_km === 'number' ? Math.max(0, Number(total_distance_km)) : 0;

    if (!ride) {
      const finalDist = clientReportedDist;
      const initialFare = backendCalculateFare(
        finalDist,
        effectiveRate,
        effectiveBase,
        effectiveMin
      );
      ride = {
        ride_id: req.params.id,
        passenger_id: 'USR-8821',
        passenger_name: 'Hemant Kashyap',
        bike_id: 'PB65AA1257',
        bike_name: 'Mahindra Centuro PB65AA1257',
        bike_type: 'Motorcycle',
        status: 'COMPLETED',
        start_time: now,
        end_time: now,
        start_latitude: Number(end_latitude),
        start_longitude: Number(end_longitude),
        start_address: 'Origin Location',
        end_latitude: Number(end_latitude),
        end_longitude: Number(end_longitude),
        end_address: end_address || `Destination (GPS: ${Number(end_latitude).toFixed(4)}, ${Number(end_longitude).toFixed(4)})`,
        total_distance_km: finalDist,
        rate_per_km: effectiveRate,
        base_unlock_fee: effectiveBase,
        minimum_fare: effectiveMin,
        final_fare: initialFare.totalFare,
        locations: [],
        duration_seconds: Number(duration_seconds) || 1,
        pause_duration_seconds: 0,
        max_speed_kmh: 0,
        avg_speed_kmh: 0,
        created_at: now,
        updated_at: now,
        payment_status: 'UNPAID',
      };
      saveRide(ride);
      return res.json({
        success: true,
        message: 'Ride completed',
        ride,
        fareBreakdown: {
          distanceKm: finalDist,
          ratePerKm: effectiveRate,
          distanceFare: initialFare.distanceFare,
          baseFee: initialFare.baseFee,
          totalFare: initialFare.totalFare,
        },
      });
    }

    ride.status = 'COMPLETED';
    ride.end_time = now;
    if (duration_seconds) {
      ride.duration_seconds = Number(duration_seconds);
    } else {
      const startTimeMs = new Date(ride.start_time).getTime();
      ride.duration_seconds = Math.max(1, Math.floor((Date.now() - startTimeMs) / 1000));
    }

    if (end_latitude !== undefined && end_longitude !== undefined) {
      ride.end_latitude = Number(end_latitude);
      ride.end_longitude = Number(end_longitude);
      ride.end_address =
        end_address ||
        `Destination (GPS: ${Number(end_latitude).toFixed(4)}, ${Number(end_longitude).toFixed(4)})`;

      // Check final distance step if valid
      const lastPoint = ride.locations[ride.locations.length - 1];
      if (lastPoint && accuracy <= pricingSettings.max_gps_accuracy_threshold_m) {
        const finalDelta = backendHaversineDistanceKm(
          lastPoint.latitude,
          lastPoint.longitude,
          Number(end_latitude),
          Number(end_longitude)
        );
        if (
          finalDelta * 1000 >= pricingSettings.min_movement_threshold_m &&
          finalDelta <= 5.0
        ) {
          ride.total_distance_km = Number((ride.total_distance_km + finalDelta).toFixed(3));
        }
      }
    }

    // Retain maximum valid distance between server-accumulated and client-tracked distance
    const finalizedDistance = Number(Math.max(ride.total_distance_km, clientReportedDist).toFixed(3));
    ride.total_distance_km = finalizedDistance;
    ride.rate_per_km = effectiveRate;
    ride.base_unlock_fee = effectiveBase;
    ride.minimum_fare = effectiveMin;

    // Authoritative Final Fare Calculation on backend
    const finalFareCalc = backendCalculateFare(
      finalizedDistance,
      effectiveRate,
      effectiveBase,
      effectiveMin
    );

    ride.final_fare = finalFareCalc.totalFare;
    if (ride.duration_seconds > 0) {
      ride.avg_speed_kmh = Number(
        ((ride.total_distance_km / (ride.duration_seconds / 3600)) || 0).toFixed(1)
      );
    }

    saveRide(ride);
    updateBikeAvailability(ride.bike_id, true);

    res.json({
      success: true,
      message: 'Ride completed successfully',
      ride,
      fareBreakdown: {
        distanceKm: finalizedDistance,
        ratePerKm: effectiveRate,
        distanceFare: finalFareCalc.distanceFare,
        baseFee: finalFareCalc.baseFee,
        totalFare: finalFareCalc.totalFare,
      },
    });
  });

  // Simulated Payment Checkout
  app.post('/api/rides/:id/pay', (req, res) => {
    const ride = getRideById(req.params.id);
    if (!ride) return res.status(404).json({ error: 'Ride not found' });

    ride.payment_status = 'PAID';
    saveRide(ride);

    res.json({ success: true, ride });
  });

  // Vite middleware in dev vs static files in prod
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const fs = await import('fs');
    const distPath = fs.existsSync(path.join(process.cwd(), 'dist'))
      ? path.join(process.cwd(), 'dist')
      : __dirname;
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🏍️ Motoride backend server listening on port ${PORT} (Universal Realtime Sync Active)`);
  });
}

startServer();
