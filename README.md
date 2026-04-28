# Celestial Mechanics: Three-Body Problem Simulator

A stunning, interactive visualization of the classical N-body problem, specifically tailored for the chaotic and hypnotic behavior of the Three-Body Problem.

## Overview

This application provides a real-time, high-performance simulation of gravitational interactions between three celestial bodies. Using an **RK4 (Runge-Kutta 4th Order)** integration method, the simulation offers superior stability and accuracy compared to standard Euler integration, allowing for the observation of complex, long-running orbital trajectories.

## Key Features

*   **Interactive Simulation**: Choose between multiple preset scenarios or customize physical parameters.
*   **Performance-Optimized**: Built to run smoothly in modern browsers using HTML5 Canvas.
*   **RK4 Integration**: Accurate numeric simulation for stable complex orbits.
*   **Responsive Interface**: Designed for a seamless, stunning experience across mobile and desktop devices.
*   **Stylized Visualization**: Aesthetic controls including color palettes, trail decay, and gravitational field visualization.
*   **Customization**: Adjust the Gravitational Constant (`G`), Time steps, and simulation speed in real-time.

## Tech Stack

*   **Framework**: React 18, TypeScript, Vite.
*   **Styling**: Tailwind CSS for a modern, minimalist dark-themed UI.
*   **Animations**: `motion/react` for fluid UI transitions.
*   **Icons**: `lucide-react`.

## Getting Started

1.  **Clone the repository.**
2.  **Install dependencies**:
    ```bash
    npm install
    ```
3.  **Run the development server**:
    ```bash
    npm run dev
    ```

## License

This project is open-source. Feel free to explore, learn, and modify the parameters to discover new stable chaotic orbits!
