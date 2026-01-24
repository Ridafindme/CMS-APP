import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

// Note: These imports point to your CMS app - adjust paths if needed
// For now, these are examples that won't resolve until tests are moved to cms-app
import SignInScreen from '../app/sign-in';
import { supabase } from '../lib/supabase';

// Mock Supabase
jest.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: jest.fn(),
    },
  },
}));

// Mock router
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
  }),
}));

describe('Sign In Screen - Doctor Login', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders sign in form correctly', () => {
    const { getByPlaceholderText, getByText } = render(<SignInScreen />);
    
    expect(getByPlaceholderText(/email/i)).toBeTruthy();
    expect(getByPlaceholderText(/password/i)).toBeTruthy();
    expect(getByText(/sign in/i)).toBeTruthy();
  });

  test('doctor can login with valid credentials', async () => {
    const mockSignIn = supabase.auth.signInWithPassword as jest.Mock;
    mockSignIn.mockResolvedValue({
      data: {
        user: { id: '123', email: 'doctor@test.com', user_metadata: { role: 'doctor' } },
        session: { access_token: 'token123' },
      },
      error: null,
    });

    const { getByPlaceholderText, getByText } = render(<SignInScreen />);
    
    const emailInput = getByPlaceholderText(/email/i);
    const passwordInput = getByPlaceholderText(/password/i);
    const signInButton = getByText(/sign in/i);

    fireEvent.changeText(emailInput, 'doctor@test.com');
    fireEvent.changeText(passwordInput, 'password123');
    fireEvent.press(signInButton);

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith({
        email: 'doctor@test.com',
        password: 'password123',
      });
    });
  });

  test('shows error message with invalid credentials', async () => {
    const mockSignIn = supabase.auth.signInWithPassword as jest.Mock;
    mockSignIn.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Invalid login credentials' },
    });

    const { getByPlaceholderText, getByText, findByText } = render(<SignInScreen />);
    
    const emailInput = getByPlaceholderText(/email/i);
    const passwordInput = getByPlaceholderText(/password/i);
    const signInButton = getByText(/sign in/i);

    fireEvent.changeText(emailInput, 'wrong@test.com');
    fireEvent.changeText(passwordInput, 'wrongpassword');
    fireEvent.press(signInButton);

    const errorMessage = await findByText(/invalid login credentials/i);
    expect(errorMessage).toBeTruthy();
  });

  test('validates empty fields', async () => {
    const { getByText, findByText } = render(<SignInScreen />);
    
    const signInButton = getByText(/sign in/i);
    fireEvent.press(signInButton);

    const errorMessage = await findByText(/please fill in all fields/i);
    expect(errorMessage).toBeTruthy();
  });
});
