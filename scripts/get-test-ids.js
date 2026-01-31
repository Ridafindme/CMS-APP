/**
 * Get Test IDs Helper
 * 
 * This script helps you retrieve the necessary IDs from your database
 * to configure testing.
 */

// Polyfill fetch for Node.js
require('cross-fetch/polyfill');

const { createClient } = require('@supabase/supabase-js');
const config = require('./test-config');

const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);

async function getTestIds() {
  console.log('\n🔍 Fetching test IDs from database...\n');

  try {
    // Get doctors
    const { data: doctors, error: doctorsError } = await supabase
      .from('doctors')
      .select('id, user_id, profiles!inner(full_name)')
      .limit(5);

    if (doctorsError) throw doctorsError;

    console.log('📋 Available Doctors:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    doctors.forEach((doc, index) => {
      console.log(`${index + 1}. Doctor ID: ${doc.id}`);
      console.log(`   User ID: ${doc.user_id}`);
      console.log(`   Name: ${doc.profiles?.full_name || 'N/A'}`);
      console.log('');
    });

    // Get clinics
    const { data: clinics, error: clinicsError } = await supabase
      .from('clinics')
      .select('id, name, address')
      .limit(5);

    if (clinicsError) throw clinicsError;

    console.log('\n🏥 Available Clinics:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    clinics.forEach((clinic, index) => {
      console.log(`${index + 1}. Clinic ID: ${clinic.id}`);
      console.log(`   Name: ${clinic.name}`);
      console.log(`   Address: ${clinic.address || 'N/A'}`);
      console.log('');
    });

    // Get patients
    const { data: patients, error: patientsError } = await supabase
      .from('profiles')
      .select('id, full_name, email, phone')
      .eq('user_type', 'patient')
      .limit(5);

    if (patientsError) throw patientsError;

    console.log('\n👤 Available Patients:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    patients.forEach((patient, index) => {
      console.log(`${index + 1}. Patient ID: ${patient.id}`);
      console.log(`   Name: ${patient.full_name || 'N/A'}`);
      console.log(`   Email: ${patient.email || 'N/A'}`);
      console.log(`   Phone: ${patient.phone || 'N/A'}`);
      console.log('');
    });

    console.log('\n✅ Copy these IDs to scripts/test-config.js\n');
    console.log('Example configuration:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('testData: {');
    if (doctors[0]) console.log(`  doctorId: '${doctors[0].id}',`);
    if (clinics[0]) console.log(`  clinicId: '${clinics[0].id}',`);
    if (patients[0]) console.log(`  patientId: '${patients[0].id}',`);
    console.log('  additionalPatientIds: [');
    patients.slice(1, 4).forEach((p, i) => {
      console.log(`    '${p.id}',${i < 2 ? '' : ' // Add more if needed'}`);
    });
    console.log('  ],');
    console.log('},\n');

  } catch (error) {
    console.error('❌ Error fetching IDs:', error.message);
    console.error('\n🔍 Full error details:');
    console.error(error);
    console.error('\n💡 Troubleshooting:');
    console.error('   1. Check your internet connection');
    console.error('   2. Verify Supabase URL and key in test-config.js');
    console.error('   3. Make sure your Supabase project is running');
    console.error(`   4. Current Supabase URL: ${config.supabaseUrl}`);
    process.exit(1);
  }
}

getTestIds();
