window.addEventListener("DOMContentLoaded", () => {
  function showSignup() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('signupForm').style.display = 'block';
    document.getElementById('backToLogin').style.display = 'block';
  }

  function showLogin() {
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('signupForm').style.display = 'none';
    document.getElementById('backToLogin').style.display = 'none';
    document.getElementById('signupSuccess').style.display = 'none';
  }

  window.showSignup = showSignup;
  window.showLogin = showLogin;

  document.getElementById('signupForm')?.addEventListener('submit', function (e) {
    e.preventDefault();
    const name = document.getElementById('signupName').value;
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;

    const users = JSON.parse(localStorage.getItem('users') || '{}');
    users[email] = { name, password };
    localStorage.setItem('users', JSON.stringify(users));

    document.getElementById('signupSuccess').style.display = 'block';
    document.getElementById('signupForm').reset();
  });

  document.getElementById('loginForm')?.addEventListener('submit', function (e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const users = JSON.parse(localStorage.getItem('users') || '{}');

    if (users[email] && users[email].password === password) {
      window.location.href = 'dashboard.html';
    } else {
      document.getElementById('loginError').style.display = 'block';
    }
  });
});
