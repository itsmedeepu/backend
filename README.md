# AgriDirect Backend (Dockerized)

This project contains the Docker setup for the **AgriDirect Backend**, a Node.js-based backend application.

---

## 📦 Dockerfile Overview

The Dockerfile does the following:

- Uses the official Node.js base image
- Sets the working directory to `/agridirect/backend`
- Copies `package.json` and `package-lock.json`
- Installs dependencies using `npm install`
- Copies the application source code
- Exposes port **3000**
- Starts the app using `node index.js`

---

## 🚀 Build and Run Instructions
Build the Docker Image
``` docker build -t agridirect-backend .```

---

## 🏃 Run the Container
Once the image is built, you can start the container. This maps port 3000 of the container to port 3000 on your local machine.
``` docker run -p 3000:3000 agridirect-backend ```



