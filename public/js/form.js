function submitForm() {
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;

  fetch('/add-user', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ username, password })
  })
    .then(res => res.json())
    .then(data => {
      alert('Data stored successfully');
    })
    .catch(err => {
      alert('Error storing data');
      console.error(err);
    });
}
