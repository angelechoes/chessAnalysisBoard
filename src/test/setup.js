import '@testing-library/jest-dom'

// Mock the ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor(callback) {
    this.callback = callback
  }
  observe() {
    // Mock implementation
  }
  unobserve() {
    // Mock implementation
  }
  disconnect() {
    // Mock implementation
  }
}

// Mock getBoundingClientRect for tests
Object.defineProperty(Element.prototype, 'getBoundingClientRect', {
  value: () => ({
    width: 500,
    height: 500,
    top: 0,
    left: 0,
    bottom: 500,
    right: 500,
  }),
  writable: true,
})

// Mock navigator.clipboard - make it configurable so userEvent can override it
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: () => Promise.resolve(),
    readText: () => Promise.resolve(''),
  },
  writable: true,
  configurable: true,
})