# 1. Use the official Node.js image (version 22 for latest Vite/Tailwind support)
FROM node:22-alpine

# 1b. Add compatibility for native binaries
RUN apk add --no-cache libc6-compat

# 2. Set the working directory inside the container
WORKDIR /app

# 3. Copy package.json ONLY (avoid package-lock.json platform issues)
COPY package.json ./

# 4. Install dependencies inside the container
# We use standard npm install to support cross-platform (macOS ARM64, Windows x86_64)
RUN npm install

# 5. Copy the rest of your code
COPY . .

# 6. Expose the port Vite runs on (usually 5173)
EXPOSE 5173

# 7. Start the app ensuring it accepts external connections
# --host 0.0.0.0 is CRITICAL for Docker
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]