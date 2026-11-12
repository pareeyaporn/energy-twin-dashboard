import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HotelTwin } from '@/twin/HotelTwin';

describe('2D/3D twin toggle', () => {
  it('falls back to the 2D diagram without WebGL (jsdom) and hides the 3D switch', () => {
    render(<HotelTwin />);
    expect(screen.queryByTestId('twin-3d')).toBeNull();
    expect(screen.queryByRole('group', { name: 'View' })).toBeNull();
  });
});
