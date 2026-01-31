/**
 * Quick Concurrent Booking Test
 * 
 * Simulates multiple users trying to book the same slot.
 * Perfect for testing race conditions quickly.
 * 
 * Usage: npx ts-node scripts/test-race-condition.ts
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Configure your test
const DOCTOR_ID = ''; // Set your doctor ID
const CLINIC_ID = ''; // Set your clinic ID
const PATIENT_ID = ''; // Set your patient ID
const CONCURRENT_USERS = 10; // Number of simultaneous booking attempts

async function testRaceCondition() {
  if (!DOCTOR_ID || !CLINIC_ID || !PATIENT_ID) {
    console.log('❌ Please set DOCTOR_ID, CLINIC_ID, and PATIENT_ID in the script');
    console.log('   Run: npx ts-node scripts/get-test-ids.ts to get IDs');
    return;
  }

  console.log('\n🏁 Race Condition Test Starting...\n');
  console.log(`   Doctor ID: ${DOCTOR_ID}`);
  console.log(`   Clinic ID: ${CLINIC_ID}`);
  console.log(`   Patient ID: ${PATIENT_ID}`);
  console.log(`   Concurrent attempts: ${CONCURRENT_USERS}\n`);

  // Target tomorrow at 3:00 PM
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const targetDate = tomorrow.toISOString().split('T')[0];
  const targetTime = '15:00';

  console.log(`🎯 Target slot: ${targetDate} at ${targetTime}\n`);
  console.log('⏱️  Starting concurrent booking attempts...\n');

  // Create all booking requests simultaneously
  const bookingAttempts = Array.from({ length: CONCURRENT_USERS }, (_, i) => {
    const attemptNumber = i + 1;
    const startTime = Date.now();

    return supabase
      .from('appointments')
      .insert({
        patient_id: PATIENT_ID,
        doctor_id: DOCTOR_ID,
        clinic_id: CLINIC_ID,
        appointment_date: targetDate,
        time_slot: targetTime,
        status: 'pending',
      })
      .select('id, created_at')
      .single()
      .then(result => ({
        attemptNumber,
        duration: Date.now() - startTime,
        ...result,
      }));
  });

  const startTime = Date.now();
  const results = await Promise.allSettled(bookingAttempts);
  const totalDuration = Date.now() - startTime;

  console.log('📊 Results:\n');

  let successCount = 0;
  let failCount = 0;
  const successfulIds: string[] = [];

  results.forEach((result) => {
    if (result.status === 'fulfilled') {
      const { attemptNumber, duration, data, error } = result.value;

      if (error) {
        console.log(`   ❌ Attempt ${attemptNumber}: FAILED (${duration}ms)`);
        console.log(`      Error: ${error.message}`);
        failCount++;
      } else if (data) {
        console.log(`   ✅ Attempt ${attemptNumber}: SUCCESS (${duration}ms)`);
        console.log(`      Appointment ID: ${data.id}`);
        console.log(`      Created at: ${data.created_at}`);
        successCount++;
        successfulIds.push(data.id);
      }
    } else {
      console.log(`   💥 Attempt failed to execute: ${result.reason}`);
      failCount++;
    }
  });

  console.log('\n' + '─'.repeat(60));
  console.log('\n📈 Summary:\n');
  console.log(`   Total duration: ${totalDuration}ms`);
  console.log(`   Successful bookings: ${successCount}`);
  console.log(`   Failed bookings: ${failCount}`);
  console.log(`   Average response time: ${(totalDuration / CONCURRENT_USERS).toFixed(2)}ms`);

  if (successCount === 1) {
    console.log('\n✅ PASS: Only 1 booking succeeded (race condition handled correctly)');
  } else if (successCount === 0) {
    console.log('\n⚠️  WARNING: No bookings succeeded (check if slot already booked)');
  } else {
    console.log('\n❌ FAIL: Multiple bookings succeeded (race condition NOT handled!)');
    console.log('   💡 Solution: Add unique constraint to appointments table:');
    console.log('   ALTER TABLE appointments');
    console.log('   ADD CONSTRAINT appointments_unique_slot');
    console.log('   UNIQUE (doctor_id, clinic_id, appointment_date, time_slot);');
  }

  // Cleanup
  if (successfulIds.length > 0) {
    console.log('\n🧹 Cleaning up test appointments...');
    const { error } = await supabase
      .from('appointments')
      .delete()
      .in('id', successfulIds);

    if (error) {
      console.log(`   ⚠️  Cleanup failed: ${error.message}`);
      console.log(`   IDs to delete manually: ${successfulIds.join(', ')}`);
    } else {
      console.log(`   ✅ Deleted ${successfulIds.length} test appointment(s)`);
    }
  }

  console.log('\n');
}

testRaceCondition();
