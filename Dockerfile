FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package manifests
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application files
COPY . .

# Expose port 7860
ENV PORT=7860
EXPOSE 7860

# Start application
CMD ["node", "index.js"]
