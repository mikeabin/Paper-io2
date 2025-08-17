
// window.parent.maeExportApis_(); // Disabled as this function doesn't exist
console.log("Real multiplayer enabled! Connect with friends to play together.");

// Initialize multiplayer when the page loads
document.addEventListener('DOMContentLoaded', function() {
  if (window.multiplayerClient) {
    window.multiplayerClient.connect();
  }
});
