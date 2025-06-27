async function loadProfile() {
  const pathParts = window.location.pathname.split('/');
  const customUrl = pathParts[1];

  try {
    const response = await fetch(`/api/user/${customUrl}`);
    if (!response.ok) {
      document.getElementById('content').innerHTML = `<p class="not-found">User not found</p>`;
      return;
    }

    const user = await response.json();
    document.getElementById('content').innerHTML = `
      <div class="profile-card">
        <h1>@${user.username}</h1>
        <p>Custom URL: trigger.bio/${user.customUrl}</p>
        <p>Email: ${user.email}</p>
      </div>
    `;
  } catch (err) {
    document.getElementById('content').innerHTML = `<p class="not-found">Something went wrong.</p>`;
    console.error(err);
  }
}

window.addEventListener('DOMContentLoaded', loadProfile);
