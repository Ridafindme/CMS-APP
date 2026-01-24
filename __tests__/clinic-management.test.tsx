import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

// Note: These imports point to your CMS app - adjust paths if needed
import DoctorDashboard from '../app/doctor-dashboard';
import { supabase } from '../lib/supabase';

jest.mock('../lib/supabase');
jest.mock('expo-router');

describe('Doctor Dashboard - Clinic Management', () => {
  const mockDoctorId = 'doc123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('displays create clinic button', () => {
    const { getByText } = render(<DoctorDashboard doctorId={mockDoctorId} />);
    
    expect(getByText(/add clinic/i)).toBeTruthy();
  });

  test('doctor can create new clinic', async () => {
    const mockInsert = jest.fn().mockResolvedValue({
      data: { id: 'clinic123', name: 'New Clinic' },
      error: null,
    });
    
    (supabase.from as jest.Mock).mockReturnValue({
      insert: mockInsert,
    });

    const { getByText, getByPlaceholderText } = render(<DoctorDashboard doctorId={mockDoctorId} />);
    
    fireEvent.press(getByText(/add clinic/i));
    
    // Fill in clinic details
    fireEvent.changeText(getByPlaceholderText(/clinic name/i), 'Main Medical Center');
    fireEvent.changeText(getByPlaceholderText(/address/i), '456 Health Ave');
    fireEvent.changeText(getByPlaceholderText(/phone/i), '555-0123');
    
    fireEvent.press(getByText(/save clinic/i));

    await waitFor(() => {
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          doctor_id: mockDoctorId,
          name: 'Main Medical Center',
          address: '456 Health Ave',
          phone: '555-0123',
        })
      );
    });
  });

  test('displays list of doctor clinics', async () => {
    const mockClinics = [
      { id: 'clinic1', name: 'Clinic A', address: '123 St' },
      { id: 'clinic2', name: 'Clinic B', address: '456 Ave' },
    ];

    const mockSelect = jest.fn().mockReturnValue({
      eq: jest.fn().mockResolvedValue({
        data: mockClinics,
        error: null,
      }),
    });
    
    (supabase.from as jest.Mock).mockReturnValue({
      select: mockSelect,
    });

    const { findByText } = render(<DoctorDashboard doctorId={mockDoctorId} />);
    
    expect(await findByText('Clinic A')).toBeTruthy();
    expect(await findByText('Clinic B')).toBeTruthy();
  });

  test('doctor can edit existing clinic', async () => {
    const mockUpdate = jest.fn().mockReturnValue({
      eq: jest.fn().mockResolvedValue({
        data: { id: 'clinic1', name: 'Updated Clinic' },
        error: null,
      }),
    });
    
    (supabase.from as jest.Mock).mockReturnValue({
      update: mockUpdate,
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({
          data: [{ id: 'clinic1', name: 'Old Clinic', address: '123 St' }],
          error: null,
        }),
      }),
    });

    const { getByText, getByPlaceholderText } = render(<DoctorDashboard doctorId={mockDoctorId} />);
    
    await waitFor(() => expect(getByText('Old Clinic')).toBeTruthy());
    
    fireEvent.press(getByText(/edit/i));
    fireEvent.changeText(getByPlaceholderText(/clinic name/i), 'Updated Clinic');
    fireEvent.press(getByText(/save/i));

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalled();
    });
  });

  test('doctor can delete clinic', async () => {
    const mockDelete = jest.fn().mockReturnValue({
      eq: jest.fn().mockResolvedValue({
        error: null,
      }),
    });
    
    (supabase.from as jest.Mock).mockReturnValue({
      delete: mockDelete,
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({
          data: [{ id: 'clinic1', name: 'Test Clinic', address: '123 St' }],
          error: null,
        }),
      }),
    });

    const { getByText } = render(<DoctorDashboard doctorId={mockDoctorId} />);
    
    await waitFor(() => expect(getByText('Test Clinic')).toBeTruthy());
    
    fireEvent.press(getByText(/delete/i));
    fireEvent.press(getByText(/confirm/i)); // Confirm deletion

    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalled();
    });
  });
});
