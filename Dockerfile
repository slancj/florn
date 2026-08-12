FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package manifests and patch script
COPY package*.json patch-epoxy.js ./

# Install dependencies (runs postinstall patch-epoxy.js)
RUN npm ci --only=production

# Copy remaining application files
COPY . .

# Ensure patch is applied
RUN node patch-epoxy.js

# Expose port 7860
ENV PORT=7860
EXPOSE 7860

# Start application
CMD ["node", "index.js"]
