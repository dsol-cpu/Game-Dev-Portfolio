FROM node:18-alpine

WORKDIR /app

# Install pnpm globally first
RUN npm install -g pnpm

# Copy package files first
COPY src/front_end/package*.json ./

# Install dependencies
RUN pnpm install

# Copy all files and directories
COPY src/front_end/. .

# Build the application
RUN pnpm build

# Expose the development server port
EXPOSE 5173
EXPOSE 3000

# Start the development server
CMD ["pnpm", "run", "dev", "--host"]
