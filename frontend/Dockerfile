# Step 1: Build React app
FROM node:18-alpine as build

WORKDIR /app

# Copy package.json and package-lock.json first
COPY package*.json ./
RUN npm install

# Copy all source files
COPY . .

# Build React app
RUN npm run build

# Step 2: Serve built files using lightweight web server
FROM nginx:alpine

# Copy build output to NGINX html directory
COPY --from=build /app/build /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
