import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { authStorage } from './auth';
import { appStorage } from './appStorage';
import { mobileEnv } from './env';
import { emitLogout } from './events';
import { logger } from './logger';
import { buildSensitiveRequestHeaders } from './requestSigning';
import { storageKeys } from './storageKeys';

type RetryableConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

const API_BASE_URL = `${mobileEnv.apiUrl}/api`;
const API_TIMEOUT_MS = 15000;
const STATION_CACHE_TTL_MS = 15 * 60 * 1000;
const NEARBY_CACHE_TTL_MS = 5 * 60 * 1000;
const publicRoutePrefixes = [
  '/auth/login',
  '/auth/signup',
  '/auth/reset-password',
  '/auth/refresh',
];

function isPublicRoute(url?: string) {
  return publicRoutePrefixes.some((prefix) => url?.startsWith(prefix));
}

function buildCacheKey(scope: string, params?: Record<string, unknown>) {
  const normalized = params
    ? JSON.stringify(
        Object.entries(params)
          .filter(([, value]) => value !== undefined && value !== null)
          .sort(([left], [right]) => left.localeCompare(right)),
      )
    : 'all';

  return `${storageKeys.stationCachePrefix}:${scope}:${normalized}`;
}

async function readCachedResponse<T>(key: string, ttlMs: number): Promise<T | null> {
  const cached = await appStorage.getJson<{ savedAt: number; data: T }>(key);
  if (!cached) {
    return null;
  }

  if (Date.now() - cached.savedAt > ttlMs) {
    return null;
  }

  return cached.data;
}

async function writeCachedResponse<T>(key: string, data: T): Promise<void> {
  await appStorage.setJson(key, {
    savedAt: Date.now(),
    data,
  });
}

async function refreshAccessToken() {
  const refreshToken = await authStorage.getRefreshToken();
  if (!refreshToken) {
    return null;
  }

  const response = await axios.post(
    `${API_BASE_URL}/auth/refresh`,
    { refreshToken },
    {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: API_TIMEOUT_MS,
    },
  );

  const nextToken = response.data?.token;
  const nextRefreshToken = response.data?.refreshToken || refreshToken;

  if (!nextToken) {
    return null;
  }

  await authStorage.saveSession(nextToken, nextRefreshToken);
  if (response.data?.user) {
    await authStorage.saveUser(response.data.user);
  }

  return nextToken as string;
}

let refreshPromise: Promise<string | null> | null = null;

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: API_TIMEOUT_MS,
});

api.interceptors.request.use(
  async (config) => {
    const token = await authStorage.getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    config.headers['X-Client-Platform'] = 'expo-mobile';
    return config;
  },
  async (error) => Promise.reject(error),
);

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const status = error.response?.status;
    const url = error.config?.url;
    const originalConfig = error.config as RetryableConfig | undefined;

    if (
      status === 401 &&
      originalConfig &&
      !originalConfig._retry &&
      !isPublicRoute(url)
    ) {
      originalConfig._retry = true;

      try {
        refreshPromise ??= refreshAccessToken().finally(() => {
          refreshPromise = null;
        });
        const nextToken = await refreshPromise;

        if (nextToken) {
          originalConfig.headers.Authorization = `Bearer ${nextToken}`;
          return api(originalConfig);
        }
      } catch (refreshError) {
        logger.warn('Access token refresh failed', refreshError);
      }

      await authStorage.clearAuth();
      emitLogout();
    }

    logger.warn('API request failed', {
      status,
      url,
      code: error.code,
    });
    return Promise.reject(error);
  },
);

export const authApi = {
  signup: async (data: {
    name: string;
    email: string;
    phone: string;
    vehicleNo: string;
    password: string;
    referralCode?: string;
    deviceFingerprint?: string;
    referralSource?: string;
  }) => {
    const response = await api.post('/auth/signup', data);
    return response.data;
  },

  login: async (data: { email: string; password: string }) => {
    const response = await api.post('/auth/login', data);
    return response.data;
  },

  refreshToken: async () => {
    const nextToken = await refreshAccessToken();
    return nextToken;
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      await authStorage.clearAuth();
    }
  },

  forgotPassword: async (data: { identifier: string; sessionToken?: string }) => {
    const response = await api.post('/auth/reset-password', {
      action: 'send',
      identifier: data.identifier,
      sessionToken: data.sessionToken,
    });
    return response.data;
  },

  verifyOtp: async (data: { identifier: string; otp: string; sessionToken?: string }) => {
    const response = await api.post('/auth/reset-password', {
      action: 'verify',
      identifier: data.identifier,
      otp: data.otp,
      sessionToken: data.sessionToken,
    });
    return response.data;
  },

  resetPassword: async (data: {
    identifier: string;
    newPassword: string;
    otp?: string;
    resetToken?: string;
  }) => {
    const response = await api.post('/auth/reset-password', {
      action: 'reset',
      identifier: data.identifier,
      otp: data.otp,
      resetToken: data.resetToken,
      newPassword: data.newPassword,
    });
    return response.data;
  },
};

export const stationsApi = {
  list: async (params?: {
    lat?: number;
    lng?: number;
    radius?: number;
    city?: string;
    state?: string;
    fuelType?: string;
  }) => {
    const cacheKey = buildCacheKey('stations', params);

    try {
      const response = await api.get('/stations', { params });
      await writeCachedResponse(cacheKey, response.data);
      return response.data;
    } catch (error) {
      const cached = await readCachedResponse(cacheKey, STATION_CACHE_TTL_MS);
      if (cached) {
        return cached;
      }

      throw error;
    }
  },
};

export const nearbyStationsApi = {
  list: async (data: {
    lat: number;
    lng: number;
    radius?: number;
    limit?: number;
    googleOnly?: boolean;
  }) => {
    const cacheKey = buildCacheKey('nearby', data);

    try {
      const response = await api.post('/nearby-stations', data);
      await writeCachedResponse(cacheKey, response.data);
      return response.data;
    } catch (error) {
      const cached = await readCachedResponse(cacheKey, NEARBY_CACHE_TTL_MS);
      if (cached) {
        return cached;
      }

      throw error;
    }
  },
};

export const suggestPumpsApi = {
  suggest: async (data: {
    plate?: string;
    lat: number;
    lng: number;
    fuelType?: string;
    radiusKm?: number;
    searchQuery?: string;
    sortBy?: 'distance' | 'rating' | 'name';
  }) => {
    const response = await api.post('/suggest-pumps', data);
    return response.data;
  },
};

export const navigationApi = {
  getRoute: async (data: {
    origin: { lat: number; lng: number };
    destination: { lat: number; lng: number };
    mode?: 'driving' | 'walking';
  }) => {
    const response = await api.post('/navigation/route', data);
    return response.data;
  },
};

export const voiceQueryApi = {
  processQuery: async (data: {
    query: string;
    lat?: number;
    lng?: number;
  }) => {
    const response = await api.post('/voice-query', data);
    return response.data;
  },
};

export const searchStationsApi = {
  search: async (data: {
    query: string;
    lat?: number;
    lng?: number;
    fuelTypes?: string[];
    radiusKm?: number;
    limit?: number;
  }) => {
    const response = await api.post('/stations/search', data);
    return response.data;
  },
};

export const routePlanningApi = {
  planRoute: async (data: {
    origin: {
      lat: number;
      lng: number;
      address?: string;
    };
    destination: {
      lat: number;
      lng: number;
      address?: string;
    };
    travelMode?: 'driving' | 'motorcycle' | 'transit' | 'walking' | 'bicycling';
    fuelType?: 'CNG';
    avoidTolls?: boolean;
    avoidHighways?: boolean;
  }) => {
    const response = await api.post('/routes/plan', data);
    return response.data;
  },
};

export const placesApi = {
  autocomplete: async (data: {
    input: string;
    lat?: number;
    lng?: number;
    radius?: number;
    types?: string;
  }) => {
    const response = await api.post('/places/autocomplete', data);
    return response.data;
  },

  getDetails: async (placeId: string) => {
    const response = await api.post('/places/details', { placeId });
    return response.data;
  },
};

export const customerProfileApi = {
  get: async () => {
    const response = await api.get('/customer/profile');
    return response.data;
  },
  getSubscriptionStatus: async () => {
    const response = await api.get('/customer/subscription');
    return response.data;
  },
  update: async (data: { name?: string; phone?: string | null }) => {
    const response = await api.put('/customer/profile', data);
    return response.data;
  },
  subscribe: async (data: { planType: string; autoPay?: boolean }) => {
    const response = await api.post('/customer/subscription', data);
    return response.data;
  },
  createOrder: async (data: { planId: string }) => {
    const headers = await buildSensitiveRequestHeaders(data);
    const response = await api.post('/payments/create-order', data, { headers });
    return response.data;
  },

  verifyPayment: async (data: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
    planType: string;
  }) => {
    const headers = await buildSensitiveRequestHeaders(data);
    const response = await api.post('/payments/verify', data, { headers });
    return response.data;
  },
};

export const referralApi = {
  getReferralInfo: async () => {
    const response = await api.get('/customer/referral');
    return response.data;
  },

  applyReferralCode: async (data: {
    referralCode: string;
    deviceFingerprint?: string;
    referralSource?: string;
  }) => {
    const response = await api.post('/customer/referral', data);
    return response.data;
  },
};

export const payoutApi = {
  getPayoutInfo: async () => {
    const response = await api.get('/customer/payout');
    return response.data;
  },

  requestPayout: async (data: {
    amount: number;
    payoutMethod: 'bank_transfer' | 'upi';
    payoutMethodId?: string;
    instantPayout?: boolean;
    otpCode: string;
    accountDetails?: {
      accountNumber: string;
      ifsc: string;
      accountHolderName: string;
      upiId?: string;
    };
  }) => {
    const headers = await buildSensitiveRequestHeaders(data);
    const response = await api.post('/customer/payout', data, { headers });
    return response.data;
  },
};

export const vehicleApi = {
  list: async () => {
    const response = await api.get('/customer/vehicles');
    return response.data;
  },

  add: async (plate: string) => {
    const response = await api.post('/customer/vehicles', { plate });
    return response.data;
  },

  update: async (id: string, plate: string) => {
    const response = await api.put(`/customer/vehicles/${id}`, { plate });
    return response.data;
  },

  remove: async (id: string) => {
    const response = await api.delete(`/customer/vehicles/${id}`);
    return response.data;
  },
};

export const crowdApi = {
  update: async (stationId: string, crowdLevel: 'low' | 'medium' | 'high') => {
    const response = await api.post(`/stations/${stationId}/crowd`, { crowdLevel });
    return response.data;
  },
};

export default api;
