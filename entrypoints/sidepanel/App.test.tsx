import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('App', () => {
  it('전시카테고리 탭이 보인다', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: '전시카테고리' })).toBeTruthy();
  });
});
