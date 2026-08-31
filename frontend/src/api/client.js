import axios from "axios";

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

// Attaches the stored access token to every request, so callers never
// have to add the header themselves.
client.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// The access token is short-lived by design (SIMPLE_JWT default).
// Without this, every request made after it expires just fails with 401 —
// which looked like "no rows" / "couldn't load" on screens that were
// otherwise working fine. On a 401, try the refresh token once; if that
// also fails, the session is genuinely over and we send the user back to
// login.
let refreshPromise = null;

const clearSessionAndRedirect = () => {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("user");
  window.location.href = "/login";
};

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config, response } = error;

    if (response?.status !== 401 || config._retried || config.url?.includes("/token/refresh/")) {
      return Promise.reject(error);
    }
    config._retried = true;

    const refreshToken = localStorage.getItem("refresh_token");
    if (!refreshToken) {
      clearSessionAndRedirect();
      return Promise.reject(error);
    }

    try {
      // Multiple requests can 401 around the same time (e.g. a page that
      // fires several calls on mount) — share one in-flight refresh
      // instead of racing several token/refresh/ calls.
      if (!refreshPromise) {
        refreshPromise = axios
          .post(`${import.meta.env.VITE_API_URL}/api/identity/token/refresh/`, {
            refresh: refreshToken,
          })
          .finally(() => {
            refreshPromise = null;
          });
      }
      const { data } = await refreshPromise;
      localStorage.setItem("access_token", data.access);

      config.headers.Authorization = `Bearer ${data.access}`;
      return client(config);
    } catch (refreshError) {
      clearSessionAndRedirect();
      return Promise.reject(refreshError);
    }
  }
);

export default client;
