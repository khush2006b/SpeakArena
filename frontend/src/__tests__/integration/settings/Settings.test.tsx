import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { SettingsForm } from '@/features/auth/components/SettingsForm';
import { ToastContainer } from 'react-toastify';

expect.extend(toHaveNoViolations);

const handlers = [
  http.patch('/api/v1/auth/me', () => {
    return HttpResponse.json({
      success: true,
      data: {
        id: '1',
        email: 'updated@example.com',
        username: 'updated_user',
      },
    });
  }),
  http.post('/api/v1/auth/me/change-password', () => {
    return HttpResponse.json({
      success: true,
      message: 'Password changed successfully',
    });
  }),
];

const server = setupServer(...handlers);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <>
      {ui}
      <ToastContainer />
    </>
  );
};

describe('SettingsForm', () => {
  it('renders profile and password update forms', () => {
    renderWithProviders(<SettingsForm />);
    
    expect(screen.getByRole('heading', { name: /profile settings/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /change password/i })).toBeInTheDocument();
    
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /update profile/i })).toBeInTheDocument();

    expect(screen.getByLabelText(/current password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^new password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm new password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /change password/i })).toBeInTheDocument();
  });

  it('validates invalid email in profile form', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SettingsForm />);

    const emailInput = screen.getByLabelText(/email/i);
    await user.clear(emailInput);
    await user.type(emailInput, 'invalid-email');
    
    const updateButton = screen.getByRole('button', { name: /update profile/i });
    await user.click(updateButton);

    expect(await screen.findByText(/invalid email address/i)).toBeInTheDocument();
  });

  it('validates weak password in password form', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SettingsForm />);

    const currentPassword = screen.getByLabelText(/current password/i);
    const newPassword = screen.getByLabelText(/^new password$/i);
    const confirmPassword = screen.getByLabelText(/confirm new password/i);

    await user.type(currentPassword, 'OldPass123!');
    await user.type(newPassword, 'weak');
    await user.type(confirmPassword, 'weak');

    const changePasswordButton = screen.getByRole('button', { name: /change password/i });
    await user.click(changePasswordButton);

    expect(await screen.findByText(/password must be at least 8 characters/i)).toBeInTheDocument();
  });

  it('submits profile update successfully and shows toast', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SettingsForm />);

    const emailInput = screen.getByLabelText(/email/i);
    const usernameInput = screen.getByLabelText(/username/i);

    await user.clear(emailInput);
    await user.type(emailInput, 'updated@example.com');
    await user.clear(usernameInput);
    await user.type(usernameInput, 'updated_user');

    const updateButton = screen.getByRole('button', { name: /update profile/i });
    await user.click(updateButton);

    await waitFor(() => {
      expect(screen.getByText(/profile updated successfully/i)).toBeInTheDocument();
    });
  });

  it('submits password change successfully and shows toast', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SettingsForm />);

    const currentPassword = screen.getByLabelText(/current password/i);
    const newPassword = screen.getByLabelText(/^new password$/i);
    const confirmPassword = screen.getByLabelText(/confirm new password/i);

    await user.type(currentPassword, 'OldPass123!');
    await user.type(newPassword, 'NewStrongPass123!');
    await user.type(confirmPassword, 'NewStrongPass123!');

    const changePasswordButton = screen.getByRole('button', { name: /change password/i });
    await user.click(changePasswordButton);

    await waitFor(() => {
      expect(screen.getByText(/password changed successfully/i)).toBeInTheDocument();
    });
  });

  it('has no accessibility violations', async () => {
    const { container } = renderWithProviders(<SettingsForm />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('supports keyboard navigation for inputs', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SettingsForm />);

    const emailInput = screen.getByLabelText(/email/i);
    const usernameInput = screen.getByLabelText(/username/i);
    const updateProfileBtn = screen.getByRole('button', { name: /update profile/i });

    const currentPassword = screen.getByLabelText(/current password/i);
    const newPassword = screen.getByLabelText(/^new password$/i);
    const confirmPassword = screen.getByLabelText(/confirm new password/i);
    const changePasswordBtn = screen.getByRole('button', { name: /change password/i });

    await user.tab();
    expect(emailInput).toHaveFocus();
    
    await user.tab();
    expect(usernameInput).toHaveFocus();
    
    await user.tab();
    expect(updateProfileBtn).toHaveFocus();

    await user.tab();
    expect(currentPassword).toHaveFocus();

    await user.tab();
    expect(newPassword).toHaveFocus();

    await user.tab();
    expect(confirmPassword).toHaveFocus();

    await user.tab();
    expect(changePasswordBtn).toHaveFocus();
  });
});
