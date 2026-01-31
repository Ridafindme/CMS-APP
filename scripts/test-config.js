/**
 * Testing Configuration
 * 
 * Fill in your actual IDs from the database before running tests.
 * Run `npm run test:ids` to get these values easily.
 */

module.exports = {
  // Your Supabase configuration (from lib/supabase.ts)
  supabaseUrl: 'https://awqywawapwkpfpcxlbcl.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3cXl3YXdhcHdrcGZwY3hsYmNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzc3MzQxMTMsImV4cCI6MjA1MzMxMDExM30.j-kgGJ0Ln9W3JqGdMW7vO_m7UhP7p0nYRd_b1L5s4To',

  // Test IDs - CONFIGURED WITH YOUR ACTUAL VALUES
  testData: {
    // Doctor ID (from doctors table) - Dr. Sarah Ahmed
    doctorId: '5038c62c-2265-49eb-a3ec-26d22a8f1e89',
    
    // Clinic ID (from clinics table) - Clinic 1
    clinicId: 'bc7815e9-ce77-4ac7-958b-3b3f178699d0',
    
    // Patient/User ID (from profiles table) - Ahmad 1
    patientId: '57d0d565-e638-4154-93b4-25030f8021fc',
    
    // Additional test patient IDs for concurrent tests
    additionalPatientIds: [
      '79304246-013b-4f3d-b7c7-d2138dcf1f6b', // Patient 2
      '33fc8d4d-b777-4f7c-bb2b-0fcae4190738', // Patient 3
      'e060efb7-b8b9-4033-9866-c2186b57981c', // Patient 4
    ],
  },

  // Test configuration
  testConfig: {
    // Number of appointments to create in heavy load test
    heavyLoadCount: 50,
    
    // Number of concurrent booking attempts to simulate
    concurrentBookingCount: 5,
    
    // Delay between operations (milliseconds)
    operationDelay: 100,
    
    // Test appointment date (defaults to today + 1)
    testDateOffset: 1, // days from today
    
    // Test time slot
    testTimeSlot: '10:00',
  },

  // Cleanup options
  cleanup: {
    // Whether to auto-cleanup test data after tests
    autoCleanup: false,
    
    // Test appointment identifier (status will be set to 'test')
    testStatus: 'test',
  },
};
