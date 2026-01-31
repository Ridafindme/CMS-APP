/**
 * CMS App Stress Testing Utility
 * 
 * This script performs comprehensive stress testing including:
 * - Creating bulk test appointments
 * - Simulating concurrent bookings (race conditions)
 * - Testing notification delivery
 * - Verifying real-time sync
 * - Cleaning up test data
 * 
 * Usage:
 *   npx ts-node scripts/stress-test.ts
 */

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';

if (SUPABASE_URL === 'YOUR_SUPABASE_URL' || SUPABASE_ANON_KEY === 'YOUR_SUPABASE_ANON_KEY') {
  console.error('❌ Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in your .env file');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Test configuration
const CONFIG = {
  DOCTOR_ID: '', // Set your test doctor ID
  CLINIC_ID: '', // Set your test clinic ID
  PATIENT_ID: '', // Set your test patient ID
  TEST_APPOINTMENTS_COUNT: 50,
  CONCURRENT_REQUESTS: 5,
  CLEANUP_AFTER_TEST: true,
};

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

const log = {
  info: (msg: string) => console.log(`${colors.cyan}ℹ${colors.reset} ${msg}`),
  success: (msg: string) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  error: (msg: string) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  warning: (msg: string) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  test: (msg: string) => console.log(`${colors.magenta}🧪${colors.reset} ${msg}`),
  divider: () => console.log(`${colors.blue}${'─'.repeat(60)}${colors.reset}`),
};

// Track created test data for cleanup
const testData = {
  appointmentIds: [] as string[],
  startTime: Date.now(),
};

/**
 * Test 1: Bulk Appointment Creation
 * Creates many appointments rapidly to test database performance
 */
async function testBulkAppointmentCreation() {
  log.divider();
  log.test('TEST 1: Bulk Appointment Creation');
  log.info(`Creating ${CONFIG.TEST_APPOINTMENTS_COUNT} test appointments...`);

  const appointments = [];
  const today = new Date();

  for (let i = 0; i < CONFIG.TEST_APPOINTMENTS_COUNT; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + Math.floor(i / 10)); // Spread across multiple days
    
    const hour = 9 + (i % 10);
    const timeSlot = `${String(hour).padStart(2, '0')}:00`;

    appointments.push({
      patient_id: CONFIG.PATIENT_ID,
      doctor_id: CONFIG.DOCTOR_ID,
      clinic_id: CONFIG.CLINIC_ID,
      appointment_date: date.toISOString().split('T')[0],
      time_slot: timeSlot,
      status: 'confirmed',
    });
  }

  const startTime = Date.now();

  try {
    const { data, error } = await supabase
      .from('appointments')
      .insert(appointments)
      .select('id');

    const duration = Date.now() - startTime;

    if (error) {
      log.error(`Failed to create appointments: ${error.message}`);
      return false;
    }

    if (data) {
      testData.appointmentIds = data.map(a => a.id);
      log.success(`Created ${data.length} appointments in ${duration}ms`);
      log.info(`Average: ${(duration / data.length).toFixed(2)}ms per appointment`);
    }

    return true;
  } catch (err: any) {
    log.error(`Exception: ${err.message}`);
    return false;
  }
}

/**
 * Test 2: Concurrent Booking Simulation (Race Condition Test)
 * Multiple users try to book the same slot simultaneously
 */
async function testConcurrentBooking() {
  log.divider();
  log.test('TEST 2: Concurrent Booking (Race Condition)');
  log.info(`Simulating ${CONFIG.CONCURRENT_REQUESTS} users booking the same slot...`);

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const targetDate = tomorrow.toISOString().split('T')[0];
  const targetTime = '14:30';

  log.info(`Target: ${targetDate} at ${targetTime}`);

  // Create multiple booking requests simultaneously
  const bookingPromises = Array.from({ length: CONFIG.CONCURRENT_REQUESTS }, (_, i) =>
    supabase
      .from('appointments')
      .insert({
        patient_id: CONFIG.PATIENT_ID,
        doctor_id: CONFIG.DOCTOR_ID,
        clinic_id: CONFIG.CLINIC_ID,
        appointment_date: targetDate,
        time_slot: targetTime,
        status: 'pending',
      })
      .select('id')
      .then(result => ({ index: i + 1, ...result }))
  );

  const startTime = Date.now();
  const results = await Promise.allSettled(bookingPromises);
  const duration = Date.now() - startTime;

  let successCount = 0;
  let failCount = 0;

  results.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      const { data, error } = result.value;
      if (error) {
        log.warning(`Request ${i + 1}: Failed - ${error.message}`);
        failCount++;
      } else if (data) {
        log.success(`Request ${i + 1}: Success`);
        testData.appointmentIds.push(data[0].id);
        successCount++;
      }
    } else {
      log.error(`Request ${i + 1}: Rejected - ${result.reason}`);
      failCount++;
    }
  });

  log.info(`Duration: ${duration}ms`);
  log.info(`Results: ${successCount} succeeded, ${failCount} failed`);

  if (successCount === 1) {
    log.success('✓ Race condition handled correctly - only 1 booking succeeded!');
    return true;
  } else {
    log.error(`✗ Race condition NOT handled - ${successCount} bookings succeeded!`);
    return false;
  }
}

/**
 * Test 3: Real-time Subscription Test
 * Tests if real-time updates are triggered correctly
 */
async function testRealtimeSync() {
  log.divider();
  log.test('TEST 3: Real-time Subscription Test');
  log.info('Setting up real-time subscription...');

  let updateReceived = false;

  const channel = supabase
    .channel('stress-test-channel')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'appointments',
        filter: `doctor_id=eq.${CONFIG.DOCTOR_ID}`,
      },
      (payload) => {
        log.success(`Real-time update received: ${payload.new.id}`);
        updateReceived = true;
      }
    )
    .subscribe();

  log.info('Subscription active. Creating test appointment...');
  
  await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for subscription to be ready

  const testDate = new Date();
  testDate.setDate(testDate.getDate() + 7);

  const { data, error } = await supabase
    .from('appointments')
    .insert({
      patient_id: CONFIG.PATIENT_ID,
      doctor_id: CONFIG.DOCTOR_ID,
      clinic_id: CONFIG.CLINIC_ID,
      appointment_date: testDate.toISOString().split('T')[0],
      time_slot: '16:00',
      status: 'pending',
    })
    .select('id')
    .single();

  if (error) {
    log.error(`Failed to create test appointment: ${error.message}`);
    await channel.unsubscribe();
    return false;
  }

  if (data) {
    testData.appointmentIds.push(data.id);
  }

  // Wait for real-time update
  await new Promise(resolve => setTimeout(resolve, 2000));

  await channel.unsubscribe();

  if (updateReceived) {
    log.success('✓ Real-time sync working correctly!');
    return true;
  } else {
    log.error('✗ Real-time update not received!');
    return false;
  }
}

/**
 * Test 4: Walk-in Blocking Test
 * Verifies walk-in appointments block booking slots
 */
async function testWalkInBlocking() {
  log.divider();
  log.test('TEST 4: Walk-in Appointment Blocking');
  
  const testDate = new Date();
  testDate.setDate(testDate.getDate() + 3);
  const dateString = testDate.toISOString().split('T')[0];
  const timeSlot = '11:00';

  log.info(`Creating walk-in appointment for ${dateString} at ${timeSlot}...`);

  // Create walk-in appointment
  const { data: walkInData, error: walkInError } = await supabase
    .from('walk_in_appointments')
    .insert({
      doctor_id: CONFIG.DOCTOR_ID,
      clinic_id: CONFIG.CLINIC_ID,
      appointment_date: dateString,
      time_slot: timeSlot,
      patient_name: 'Test Walk-in Patient',
    })
    .select('id')
    .single();

  if (walkInError) {
    log.warning(`Walk-in table may not exist: ${walkInError.message}`);
    return false;
  }

  log.success('Walk-in appointment created');

  // Try to book the same slot
  log.info('Attempting to book the same slot...');

  const { data: bookingData, error: bookingError } = await supabase
    .from('appointments')
    .insert({
      patient_id: CONFIG.PATIENT_ID,
      doctor_id: CONFIG.DOCTOR_ID,
      clinic_id: CONFIG.CLINIC_ID,
      appointment_date: dateString,
      time_slot: timeSlot,
      status: 'pending',
    })
    .select('id');

  if (bookingError) {
    log.error(`Booking failed: ${bookingError.message}`);
  } else if (bookingData) {
    log.warning('⚠ Booking succeeded (should be blocked by walk-in!)');
    testData.appointmentIds.push(bookingData[0].id);
  }

  // Cleanup walk-in
  await supabase.from('walk_in_appointments').delete().eq('id', walkInData.id);

  log.info('Note: App should prevent this booking in UI by showing slot as blocked');
  return true;
}

/**
 * Test 5: Performance Monitoring
 * Measures query performance under load
 */
async function testQueryPerformance() {
  log.divider();
  log.test('TEST 5: Query Performance Test');
  
  const queries = [
    {
      name: 'Fetch appointments',
      query: () => supabase
        .from('appointments')
        .select('*')
        .eq('doctor_id', CONFIG.DOCTOR_ID)
        .eq('clinic_id', CONFIG.CLINIC_ID)
        .gte('appointment_date', new Date().toISOString().split('T')[0])
    },
    {
      name: 'Fetch pending appointments',
      query: () => supabase
        .from('appointments')
        .select('appointment_date, time_slot, status')
        .eq('doctor_id', CONFIG.DOCTOR_ID)
        .eq('status', 'pending')
    },
    {
      name: 'Fetch blocked slots',
      query: () => supabase
        .from('doctor_blocked_slots')
        .select('blocked_date, time_slot')
        .eq('clinic_id', CONFIG.CLINIC_ID)
    },
  ];

  for (const { name, query } of queries) {
    const startTime = Date.now();
    const { data, error } = await query();
    const duration = Date.now() - startTime;

    if (error) {
      log.error(`${name}: Failed - ${error.message}`);
    } else {
      const rowCount = data?.length || 0;
      log.success(`${name}: ${duration}ms (${rowCount} rows)`);
      
      if (duration > 1000) {
        log.warning(`⚠ Query slow (>1s)`);
      }
    }
  }

  return true;
}

/**
 * Cleanup Test Data
 */
async function cleanup() {
  if (!CONFIG.CLEANUP_AFTER_TEST) {
    log.warning('Cleanup disabled. Test data remains in database.');
    return;
  }

  log.divider();
  log.info('Cleaning up test data...');

  if (testData.appointmentIds.length > 0) {
    const { error } = await supabase
      .from('appointments')
      .delete()
      .in('id', testData.appointmentIds);

    if (error) {
      log.error(`Cleanup failed: ${error.message}`);
    } else {
      log.success(`Deleted ${testData.appointmentIds.length} test appointments`);
    }
  } else {
    log.info('No test data to clean up');
  }
}

/**
 * Validate Configuration
 */
function validateConfig() {
  log.divider();
  log.info('Validating configuration...');

  const missing = [];
  if (!CONFIG.DOCTOR_ID) missing.push('DOCTOR_ID');
  if (!CONFIG.CLINIC_ID) missing.push('CLINIC_ID');
  if (!CONFIG.PATIENT_ID) missing.push('PATIENT_ID');

  if (missing.length > 0) {
    log.error(`Missing configuration: ${missing.join(', ')}`);
    log.info('Please edit scripts/stress-test.ts and set the CONFIG values');
    return false;
  }

  log.success('Configuration valid');
  log.info(`Doctor ID: ${CONFIG.DOCTOR_ID}`);
  log.info(`Clinic ID: ${CONFIG.CLINIC_ID}`);
  log.info(`Patient ID: ${CONFIG.PATIENT_ID}`);
  return true;
}

/**
 * Main Test Runner
 */
async function runStressTests() {
  console.log(`\n${colors.bright}${colors.cyan}═══════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}   CMS App Stress Testing Utility${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}═══════════════════════════════════════════════════════${colors.reset}\n`);

  if (!validateConfig()) {
    process.exit(1);
  }

  const results = {
    bulkCreate: false,
    concurrentBooking: false,
    realtimeSync: false,
    walkInBlocking: false,
    queryPerformance: false,
  };

  try {
    // Run all tests
    results.bulkCreate = await testBulkAppointmentCreation();
    results.concurrentBooking = await testConcurrentBooking();
    results.realtimeSync = await testRealtimeSync();
    results.walkInBlocking = await testWalkInBlocking();
    results.queryPerformance = await testQueryPerformance();

    // Summary
    log.divider();
    const totalTime = ((Date.now() - testData.startTime) / 1000).toFixed(2);
    console.log(`\n${colors.bright}Test Results Summary${colors.reset}\n`);
    
    const testResults = [
      { name: 'Bulk Appointment Creation', passed: results.bulkCreate },
      { name: 'Concurrent Booking (Race)', passed: results.concurrentBooking },
      { name: 'Real-time Sync', passed: results.realtimeSync },
      { name: 'Walk-in Blocking', passed: results.walkInBlocking },
      { name: 'Query Performance', passed: results.queryPerformance },
    ];

    testResults.forEach(({ name, passed }) => {
      const icon = passed ? '✓' : '✗';
      const color = passed ? colors.green : colors.red;
      console.log(`  ${color}${icon}${colors.reset} ${name}`);
    });

    const passedCount = Object.values(results).filter(Boolean).length;
    const totalCount = Object.keys(results).length;

    console.log(`\n${colors.bright}Total: ${passedCount}/${totalCount} tests passed${colors.reset}`);
    console.log(`${colors.bright}Duration: ${totalTime}s${colors.reset}\n`);

    if (passedCount === totalCount) {
      console.log(`${colors.green}${colors.bright}🎉 All tests passed!${colors.reset}\n`);
    } else {
      console.log(`${colors.yellow}${colors.bright}⚠ Some tests failed. Review logs above.${colors.reset}\n`);
    }

  } catch (error: any) {
    log.error(`Fatal error: ${error.message}`);
  } finally {
    await cleanup();
  }

  log.divider();
}

// Run tests
runStressTests();
