/**
 * Heavy Load Testing Script
 * 
 * This script performs comprehensive stress testing on your CMS app:
 * - Creates multiple test appointments
 * - Simulates concurrent bookings
 * - Tests race conditions
 * - Validates real-time sync
 * - Monitors performance
 */

// Polyfill fetch for Node.js
require('cross-fetch/polyfill');

const { createClient } = require('@supabase/supabase-js');
const config = require('./test-config');

const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);

// Test results tracking
const results = {
  total: 0,
  successful: 0,
  failed: 0,
  conflicts: 0,
  errors: [],
  startTime: null,
  endTime: null,
};

// Helper: Generate test date
function getTestDate(offsetDays = config.testConfig.testDateOffset) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().split('T')[0];
}

// Helper: Generate time slots
function generateTimeSlots() {
  const slots = [];
  for (let hour = 9; hour < 17; hour++) {
    slots.push(`${hour.toString().padStart(2, '0')}:00`);
    slots.push(`${hour.toString().padStart(2, '0')}:30`);
  }
  return slots;
}

// Helper: Delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Test 1: Create bulk appointments
async function testBulkAppointments() {
  console.log('\n📦 Test 1: Bulk Appointment Creation');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const testDate = getTestDate();
  const timeSlots = generateTimeSlots();
  const count = Math.min(config.testConfig.heavyLoadCount, timeSlots.length);

  console.log(`Creating ${count} appointments for ${testDate}...`);

  for (let i = 0; i < count; i++) {
    results.total++;
    
    try {
      const { data, error } = await supabase
        .from('appointments')
        .insert({
          patient_id: config.testData.patientId,
          doctor_id: config.testData.doctorId,
          clinic_id: config.testData.clinicId,
          appointment_date: testDate,
          time_slot: timeSlots[i % timeSlots.length],
          status: 'test', // Mark as test for easy cleanup
        })
        .select()
        .single();

      if (error) {
        results.failed++;
        results.errors.push({ test: 'bulk', slot: timeSlots[i], error: error.message });
        console.log(`❌ Failed: ${timeSlots[i]} - ${error.message}`);
      } else {
        results.successful++;
        process.stdout.write(`✓ ${i + 1}/${count} `);
      }

      await delay(config.testConfig.operationDelay);
    } catch (err) {
      results.failed++;
      results.errors.push({ test: 'bulk', error: err.message });
      console.log(`❌ Error: ${err.message}`);
    }
  }

  console.log(`\n✅ Bulk test complete: ${results.successful}/${count} successful\n`);
}

// Test 2: Concurrent booking simulation
async function testConcurrentBookings() {
  console.log('\n⚡ Test 2: Concurrent Booking Simulation');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const testDate = getTestDate(2);
  const testSlot = config.testConfig.testTimeSlot;
  const patientIds = [
    config.testData.patientId,
    ...config.testData.additionalPatientIds,
  ].slice(0, config.testConfig.concurrentBookingCount);

  console.log(`Simulating ${patientIds.length} users booking same slot simultaneously...`);
  console.log(`Date: ${testDate}, Time: ${testSlot}\n`);

  // Create promises for concurrent execution
  const bookingPromises = patientIds.map((patientId, index) =>
    supabase
      .from('appointments')
      .insert({
        patient_id: patientId,
        doctor_id: config.testData.doctorId,
        clinic_id: config.testData.clinicId,
        appointment_date: testDate,
        time_slot: testSlot,
        status: 'test',
      })
      .select()
      .then(({ data, error }) => ({
        index,
        patientId,
        success: !error,
        error: error?.message,
        data,
      }))
  );

  const concurrentResults = await Promise.all(bookingPromises);

  concurrentResults.forEach((result) => {
    results.total++;
    if (result.success) {
      results.successful++;
      console.log(`✅ Patient ${result.index + 1}: Booking succeeded`);
    } else {
      if (result.error.includes('duplicate') || result.error.includes('conflict')) {
        results.conflicts++;
        console.log(`⚠️  Patient ${result.index + 1}: Conflict (expected) - ${result.error}`);
      } else {
        results.failed++;
        console.log(`❌ Patient ${result.index + 1}: Failed - ${result.error}`);
      }
    }
  });

  const successCount = concurrentResults.filter(r => r.success).length;
  console.log(`\n✅ Concurrent test complete: ${successCount} succeeded, ${concurrentResults.length - successCount} blocked\n`);

  if (successCount > 1) {
    console.log('⚠️  WARNING: Multiple bookings succeeded for same slot! Race condition detected.\n');
  } else if (successCount === 1) {
    console.log('✅ Perfect! Only one booking succeeded (race condition handled correctly)\n');
  }
}

// Test 3: Database stress test
async function testDatabaseStress() {
  console.log('\n💪 Test 3: Database Stress Test');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const testDate = getTestDate(3);
  const iterations = 20;

  console.log(`Running ${iterations} rapid queries...`);

  const startTime = Date.now();

  for (let i = 0; i < iterations; i++) {
    try {
      // Simulate real booking flow: check + insert
      await supabase
        .from('appointments')
        .select('id')
        .eq('doctor_id', config.testData.doctorId)
        .eq('clinic_id', config.testData.clinicId)
        .eq('appointment_date', testDate)
        .eq('time_slot', '14:00')
        .in('status', ['pending', 'confirmed']);

      process.stdout.write(`✓ `);
      await delay(50);
    } catch (err) {
      console.log(`\n❌ Query ${i + 1} failed: ${err.message}`);
    }
  }

  const endTime = Date.now();
  const totalTime = endTime - startTime;
  const avgTime = totalTime / iterations;

  console.log(`\n✅ Stress test complete: ${totalTime}ms total, ${avgTime.toFixed(2)}ms avg per query\n`);
}

// Test 4: Real-time subscription test
async function testRealTimeSubscription() {
  console.log('\n📡 Test 4: Real-Time Subscription Test');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  console.log('Setting up real-time subscription...');

  let updateCount = 0;

  const subscription = supabase
    .channel('test-appointments')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'appointments',
        filter: `doctor_id=eq.${config.testData.doctorId}`,
      },
      (payload) => {
        updateCount++;
        console.log(`📨 Real-time update ${updateCount}: ${payload.eventType}`);
      }
    )
    .subscribe();

  console.log('Subscription active. Creating test appointment to trigger update...\n');

  await delay(1000);

  // Create test appointment
  const testDate = getTestDate(4);
  await supabase
    .from('appointments')
    .insert({
      patient_id: config.testData.patientId,
      doctor_id: config.testData.doctorId,
      clinic_id: config.testData.clinicId,
      appointment_date: testDate,
      time_slot: '16:00',
      status: 'test',
    });

  console.log('Waiting for real-time update...');
  await delay(3000);

  subscription.unsubscribe();

  if (updateCount > 0) {
    console.log(`\n✅ Real-time test passed: Received ${updateCount} update(s)\n`);
  } else {
    console.log('\n❌ Real-time test failed: No updates received\n');
  }
}

// Cleanup test data
async function cleanupTestData() {
  console.log('\n🧹 Cleaning up test data...');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  try {
    const { data, error } = await supabase
      .from('appointments')
      .delete()
      .eq('status', 'test');

    if (error) {
      console.log(`❌ Cleanup failed: ${error.message}`);
    } else {
      console.log(`✅ Cleanup complete: Removed all test appointments\n`);
    }
  } catch (err) {
    console.log(`❌ Cleanup error: ${err.message}\n`);
  }
}

// Print summary
function printSummary() {
  const duration = results.endTime - results.startTime;
  
  console.log('\n╔════════════════════════════════════════════╗');
  console.log('║         TEST SUMMARY REPORT                ║');
  console.log('╚════════════════════════════════════════════╝\n');
  
  console.log(`📊 Total Operations: ${results.total}`);
  console.log(`✅ Successful: ${results.successful}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`⚠️  Conflicts: ${results.conflicts}`);
  console.log(`⏱️  Duration: ${(duration / 1000).toFixed(2)}s`);
  console.log(`📈 Success Rate: ${((results.successful / results.total) * 100).toFixed(2)}%\n`);

  if (results.errors.length > 0) {
    console.log('❌ Errors encountered:');
    results.errors.slice(0, 10).forEach((err, i) => {
      console.log(`  ${i + 1}. ${err.error}`);
    });
    if (results.errors.length > 10) {
      console.log(`  ... and ${results.errors.length - 10} more\n`);
    }
  }
}

// Main test runner
async function runAllTests() {
  console.log('\n╔════════════════════════════════════════════╗');
  console.log('║     CMS APP HEAVY LOAD TESTING SUITE      ║');
  console.log('╚════════════════════════════════════════════╝\n');

  console.log('Configuration:');
  console.log(`  Doctor ID: ${config.testData.doctorId}`);
  console.log(`  Clinic ID: ${config.testData.clinicId}`);
  console.log(`  Patient ID: ${config.testData.patientId}`);
  console.log(`  Test Count: ${config.testConfig.heavyLoadCount}`);
  console.log(`  Auto Cleanup: ${config.cleanup.autoCleanup ? 'Yes' : 'No'}\n`);

  // Validate configuration
  if (config.testData.doctorId === 'YOUR_DOCTOR_ID_HERE') {
    console.log('❌ ERROR: Please configure test IDs in scripts/test-config.js');
    console.log('💡 Run: npm run test:ids\n');
    process.exit(1);
  }

  results.startTime = Date.now();

  try {
    await testBulkAppointments();
    await testConcurrentBookings();
    await testDatabaseStress();
    await testRealTimeSubscription();
  } catch (err) {
    console.error('\n❌ Test suite error:', err.message);
  }

  results.endTime = Date.now();

  printSummary();

  if (config.cleanup.autoCleanup) {
    await cleanupTestData();
  } else {
    console.log('💡 To cleanup test data manually, run: npm run test:cleanup\n');
  }

  process.exit(0);
}

// Run tests
runAllTests();
