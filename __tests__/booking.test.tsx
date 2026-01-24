import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

// Note: These imports point to your CMS app - adjust paths if needed
import BookingScreen from '../app/booking';
import { supabase } from '../lib/supabase';

jest.mock('../lib/supabase');
jest.mock('expo-router');

describe('Booking Screen - Patient Books Appointment', () => {
  const mockDoctor = {
    id: 'doc123',
    name: 'Dr. Smith',
    specialty: 'Cardiology',
    clinics: [
      { id: 'clinic1', name: 'Main Clinic', address: '123 Medical St' }
    ]
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('displays doctor information', () => {
    const { getByText } = render(<BookingScreen doctor={mockDoctor} />);
    
    expect(getByText('Dr. Smith')).toBeTruthy();
    expect(getByText('Cardiology')).toBeTruthy();
  });

  test('patient can select clinic location', () => {
    const { getByText } = render(<BookingScreen doctor={mockDoctor} />);
    
    const clinicSelector = getByText('Main Clinic');
    fireEvent.press(clinicSelector);
    
    expect(getByText('123 Medical St')).toBeTruthy();
  });

  test('patient can select date and time', () => {
    const { getByTestId } = render(<BookingScreen doctor={mockDoctor} />);
    
    const datePicker = getByTestId('date-picker');
    fireEvent(datePicker, 'onDateChange', new Date('2026-02-01'));
    
    const timePicker = getByTestId('time-picker');
    fireEvent.press(timePicker);
    fireEvent.press(getByTestId('time-slot-10am'));
    
    expect(getByTestId('selected-time')).toHaveTextContent('10:00 AM');
  });

  test('patient can book appointment successfully', async () => {
    const mockInsert = jest.fn().mockResolvedValue({
      data: { id: 'appt123' },
      error: null,
    });
    
    (supabase.from as jest.Mock).mockReturnValue({
      insert: mockInsert,
    });

    const { getByPlaceholderText, getByText } = render(<BookingScreen doctor={mockDoctor} />);
    
    // Fill in appointment details
    fireEvent.changeText(getByPlaceholderText(/reason for visit/i), 'Regular checkup');
    fireEvent.press(getByText(/book appointment/i));

    await waitFor(() => {
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          doctor_id: 'doc123',
          clinic_id: 'clinic1',
          reason: 'Regular checkup',
          status: 'pending',
        })
      );
    });
  });

  test('shows error if booking fails', async () => {
    const mockInsert = jest.fn().mockResolvedValue({
      data: null,
      error: { message: 'Failed to create appointment' },
    });
    
    (supabase.from as jest.Mock).mockReturnValue({
      insert: mockInsert,
    });

    const { getByText, findByText } = render(<BookingScreen doctor={mockDoctor} />);
    
    fireEvent.press(getByText(/book appointment/i));

    const errorMessage = await findByText(/failed to create appointment/i);
    expect(errorMessage).toBeTruthy();
  });

  test('validates required fields before booking', async () => {
    const { getByText, findByText } = render(<BookingScreen doctor={mockDoctor} />);
    
    fireEvent.press(getByText(/book appointment/i));

    const errorMessage = await findByText(/please fill in all required fields/i);
    expect(errorMessage).toBeTruthy();
  });
});
