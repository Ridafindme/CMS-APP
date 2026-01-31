/**
 * Quick helper to get your test IDs from database
 * 
 * Usage: npx ts-node scripts/get-test-ids.ts
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function getTestIds() {
  console.log('\n📋 Fetching Test IDs from Supabase...\n');

  // Get doctors
  const { data: doctors } = await supabase
    .from('doctors')
    .select('id, user_id, specialty')
    .limit(5);

  console.log('🩺 DOCTORS:');
  doctors?.forEach((doc, i) => {
    console.log(`   ${i + 1}. ID: ${doc.id}`);
    console.log(`      Specialty: ${doc.specialty || 'N/A'}`);
  });

  // Get clinics
  const { data: clinics } = await supabase
    .from('clinics')
    .select('id, name')
    .limit(5);

  console.log('\n🏥 CLINICS:');
  clinics?.forEach((clinic, i) => {
    console.log(`   ${i + 1}. ID: ${clinic.id}`);
    console.log(`      Name: ${clinic.name || 'N/A'}`);
  });

  // Get patients (profiles)
  const { data: patients } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .eq('role', 'patient')
    .limit(5);

  console.log('\n👤 PATIENTS:');
  patients?.forEach((patient, i) => {
    console.log(`   ${i + 1}. ID: ${patient.id}`);
    console.log(`      Name: ${patient.full_name || 'N/A'}`);
    console.log(`      Email: ${patient.email || 'N/A'}`);
  });

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  
  if (user) {
    console.log('\n🔑 YOUR CURRENT USER ID:');
    console.log(`   ${user.id}`);
    console.log(`   Email: ${user.email}`);
  }

  console.log('\n📝 Copy these IDs to scripts/stress-test.ts CONFIG:\n');
  console.log('const CONFIG = {');
  console.log(`  DOCTOR_ID: '${doctors?.[0]?.id || 'paste-doctor-id-here'}',`);
  console.log(`  CLINIC_ID: '${clinics?.[0]?.id || 'paste-clinic-id-here'}',`);
  console.log(`  PATIENT_ID: '${patients?.[0]?.id || user?.id || 'paste-patient-id-here'}',`);
  console.log('  ...');
  console.log('};\n');
}

getTestIds();
