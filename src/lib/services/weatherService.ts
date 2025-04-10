// src/lib/services/weatherService.ts

export interface WeatherData {
    temperature: number;
    feelsLike?: number;
    condition: string;
    icon: string;
    wind: {
      speed: number;
      direction: string;
    };
    humidity?: number;
    uv?: number;
    precipProbability?: number;
    golfConditions: 'Poor' | 'Fair' | 'Good' | 'Excellent';
    location: string;
    forecast?: WeatherForecast[];
  }
  
  export interface WeatherForecast {
    date: string;
    condition: string;
    icon: string;
    maxTemp: number;
    minTemp: number;
    wind: {
      speed: number;
      direction: string;
    };
    precipProbability: number;
  }
  
  /**
   * Convert wind degrees to cardinal direction
   */
  function degreesToDirection(degrees: number): string {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(degrees / 22.5) % 16;
    return directions[index];
  }
  
  /**
   * Determine golf conditions based on weather parameters
   */
  function calculateGolfConditions(
    weatherCondition: string,
    windSpeed: number,
    rainProbability?: number,
    uvIndex?: number
  ): 'Poor' | 'Fair' | 'Good' | 'Excellent' {
    // Bad weather conditions for golf
    const badConditions = ['rain', 'snow', 'sleet', 'thunderstorm', 'storm', 'hail', 'blizzard', 'fog'];
    
    // Check if any bad condition exists in the weather condition string
    const hasBadCondition = badConditions.some(condition => 
      weatherCondition.toLowerCase().includes(condition)
    );
    
    // High wind is not good for golf
    const highWind = windSpeed > 15;
    
    // High rain probability is not good
    const highRainProbability = rainProbability !== undefined && rainProbability > 40;
    
    // Very high UV can be challenging
    const extremeUV = uvIndex !== undefined && uvIndex > 8;
    
    if (hasBadCondition || (highWind && highRainProbability)) {
      return 'Poor';
    } else if (highWind || highRainProbability || extremeUV) {
      return 'Fair';
    } else if (weatherCondition.toLowerCase().includes('clear') || 
               weatherCondition.toLowerCase().includes('sunny')) {
      return 'Excellent';
    } else {
      return 'Good';
    }
  }
  
  // Cache to prevent multiple identical API calls
  const apiCache: Record<string, { data: WeatherData; timestamp: number }> = {};
  const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes
  
  /**
   * Generate fallback/mock weather data for a given location
   * Used when the API fails or for development/testing
   */
  function generateFallbackWeatherData(latitude: number, longitude: number): WeatherData {
    // Generate somewhat deterministic weather based on coordinates
    const locationSeed = Math.abs((latitude * 10) + longitude) % 100;
    
    // Determine conditions based on the seed
    let condition: string;
    let icon: string;
    let temperature: number;
    
    if (locationSeed < 30) {
      condition = "Sunny";
      icon = "/assets/weather/sunny.svg";
      temperature = 75 + (locationSeed % 10);
    } else if (locationSeed < 60) {
      condition = "Partly cloudy";
      icon = "/assets/weather/partly-cloudy.svg";
      temperature = 70 + (locationSeed % 15);
    } else if (locationSeed < 80) {
      condition = "Cloudy";
      icon = "/assets/weather/cloudy.svg";
      temperature = 65 + (locationSeed % 10);
    } else {
      condition = "Light rain";
      icon = "/assets/weather/rain.svg";
      temperature = 60 + (locationSeed % 8);
    }
    
    // Wind based on coordinates
    const windSpeed = 5 + (locationSeed % 10);
    const windDirection = degreesToDirection((locationSeed * 15) % 360);
    
    // Generate a location name based on coordinates
    const locations = [
      "Local Area", "Golf Resort", "Country Club", "Seaside Links", 
      "Mountain View", "Riverside", "Downtown", "Lakeside"
    ];
    const locationName = `${locations[locationSeed % locations.length]}, Region`;
    
    const golfConditions = calculateGolfConditions(condition, windSpeed, locationSeed % 100);
    
    // Generate mock forecast
    const forecast = Array.from({ length: 3 }, (_, i) => {
      const forecastSeed = (locationSeed + (i * 10)) % 100;
      let forecastCondition: string;
      let forecastIcon: string;
      
      if (forecastSeed < 30) {
        forecastCondition = "Sunny";
        forecastIcon = "/assets/weather/sunny.svg";
      } else if (forecastSeed < 60) {
        forecastCondition = "Partly cloudy";
        forecastIcon = "/assets/weather/partly-cloudy.svg";
      } else if (forecastSeed < 80) {
        forecastCondition = "Cloudy";
        forecastIcon = "/assets/weather/cloudy.svg";
      } else {
        forecastCondition = "Light rain";
        forecastIcon = "/assets/weather/rain.svg";
      }
      
      const today = new Date();
      const forecastDate = new Date(today);
      forecastDate.setDate(today.getDate() + i + 1);
      
      return {
        date: forecastDate.toISOString().split('T')[0],
        condition: forecastCondition,
        icon: forecastIcon,
        maxTemp: temperature + (i % 5),
        minTemp: temperature - ((i + 5) % 10),
        wind: {
          speed: windSpeed + (i % 5),
          direction: degreesToDirection(((locationSeed + i * 30) * 15) % 360)
        },
        precipProbability: forecastSeed % 100
      };
    });
    
    return {
      temperature,
      feelsLike: temperature - 2,
      condition,
      icon,
      wind: {
        speed: windSpeed,
        direction: windDirection
      },
      humidity: 40 + (locationSeed % 50),
      uv: 3 + (locationSeed % 8),
      precipProbability: locationSeed % 100,
      golfConditions,
      location: locationName,
      forecast
    };
  }
  
  /**
   * Fetch weather data using WeatherAPI.com
   * @param latitude User's latitude
   * @param longitude User's longitude
   * @returns Weather data formatted for the golf app
   */
  export async function fetchWeatherData(latitude: number, longitude: number): Promise<WeatherData> {
    // Generate cache key
    const cacheKey = `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
    
    // Check if we have a valid cache
    const cachedData = apiCache[cacheKey];
    if (cachedData && (Date.now() - cachedData.timestamp) < CACHE_DURATION) {
      console.log('Using cached weather data');
      return cachedData.data;
    }
    
    try {
      // Check if we're in development or don't have an API key
      const apiKey = process.env.NEXT_PUBLIC_WEATHER_API_KEY;
      
      if (!apiKey) {
        console.log('No API key found, using fallback data');
        throw new Error('Weather API key is not defined in environment variables');
      }
      
      // Rate limiting protection - if we recently had an error, wait before trying again
      if (window.__lastWeatherApiError && (Date.now() - window.__lastWeatherApiError) < 60000) {
        console.log('Rate limiting protection active, using fallback data');
        throw new Error('Rate limiting protection');
      }
      
      console.log('Fetching fresh weather data');
      
      // Fetch from WeatherAPI.com with forecast for 3 days
      const response = await fetch(
        `https://api.weatherapi.com/v1/forecast.json?key=${apiKey}&q=${latitude},${longitude}&days=3&aqi=no`
      );
      
      if (!response.ok) {
        // Set last error timestamp
        window.__lastWeatherApiError = Date.now();
        console.error(`Weather API error: ${response.status}`);
        throw new Error(`Weather API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Extract and format the required data
      const current = data.current;
      const location = data.location;
      const forecast = data.forecast?.forecastday;
      
      // Calculate golf conditions
      const golfConditions = calculateGolfConditions(
        current.condition.text,
        current.wind_mph,
        current.precip_mm > 0 ? current.precip_mm * 10 : 0, // Convert to probability
        current.uv
      );
      
      // Format the response
      const weatherData: WeatherData = {
        temperature: current.temp_f,
        feelsLike: current.feelslike_f,
        condition: current.condition.text,
        icon: current.condition.icon,
        wind: {
          speed: current.wind_mph,
          direction: degreesToDirection(current.wind_degree)
        },
        humidity: current.humidity,
        uv: current.uv,
        precipProbability: current.precip_mm > 0 ? current.precip_mm * 10 : 0,
        golfConditions,
        location: `${location.name}, ${location.region}`,
        forecast: forecast?.map(day => ({
          date: day.date,
          condition: day.day.condition.text,
          icon: day.day.condition.icon,
          maxTemp: day.day.maxtemp_f,
          minTemp: day.day.mintemp_f,
          wind: {
            speed: day.day.maxwind_mph,
            direction: 'Varied' // Daily forecast typically doesn't have consistent wind direction
          },
          precipProbability: day.day.daily_chance_of_rain
        }))
      };
      
      // Cache the result
      apiCache[cacheKey] = {
        data: weatherData,
        timestamp: Date.now()
      };
      
      return weatherData;
    } catch (error) {
      console.error('Error fetching weather:', error);
      
      // Use fallback data
      const fallbackData = generateFallbackWeatherData(latitude, longitude);
      
      // Still cache the fallback data but with a shorter expiration
      apiCache[cacheKey] = {
        data: fallbackData,
        timestamp: Date.now() - (CACHE_DURATION / 2) // Expire in half the normal time
      };
      
      return fallbackData;
    }
  }
  
  // Add a global property for rate limiting protection
  declare global {
    interface Window {
      __lastWeatherApiError?: number;
    }
  }