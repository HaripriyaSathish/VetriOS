// Where the browser says the person is, for the attendance location check.
// Always resolves: with { latitude, longitude, accuracy } or null when the person
// said no, the browser has no location support, or it took too long. A missing
// location never blocks a check-in; the server just flags it for HR.
export function getBrowserLocation(timeoutMs = 8000) {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 }
    );
  });
}
