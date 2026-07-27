# 🐕 Surveillance Robotic Dog Control System

[![Platform](https://img.shields.io/badge/Platform-Robotics%20%26%20Surveillance-blue.svg)]()
[![Stack](https://img.shields.io/badge/Stack-Node.js%20%7C%20React%20%7C%20WebSockets-orange.svg)]()
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## 📌 Overview
The **Surveillance Robotic Dog System** provides remote telemetry, video feed streaming, and motion command controls for a quadruple robotic surveillance platform.

## ✨ Key Features
- 📹 **Live Video Streaming**: Real-time camera feed transmission from the robotic dog.
- 🎮 **Remote Control Dashboard**: Interactive joystick and directional control interface.
- 📡 **Telemetry Monitoring**: Sensor metrics dashboard (battery status, obstacle proximity, orientation).
- ⚡ **WebSocket Communication**: Low-latency bidirectional control signals between web UI and robotics controller.

## 🛠️ Tech Stack
- **Frontend**: React.js, WebSockets, HTML5 Canvas
- **Backend**: Node.js, Express, Socket.io
- **Hardware Integration**: Serial / MQTT / HTTP APIs

## 🚀 Quick Start
1. Start backend service: `cd backend && npm install && npm start`
2. Start frontend UI: `cd frontend && npm install && npm start`
3. Connect robotics hardware stream to backend socket.

## 📄 License
MIT License.
