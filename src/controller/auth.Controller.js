const login = async (email, password, rememberMe = false) => {
  try {
    setLoading(true);
    
    console.log('Sending login request to:', 'http://localhost:3001/api/auth/login');
    
    const response = await fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
      credentials: 'include'
    }).catch(networkError => {
      console.error('Network error:', networkError);
      throw new Error('Cannot connect to server. Please make sure the backend is running.');
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Login failed: ${response.status}`);
    }

    const data = await response.json();
    
    // Store based on rememberMe choice
    const storage = rememberMe ? localStorage : sessionStorage;
    storage.setItem('token', data.token);
    storage.setItem('user', JSON.stringify(data.user));
    
    setUser(data.user);
    return { success: true, user: data.user };

  } catch (error) {
    console.error('Login error:', error);
    return { 
      success: false, 
      error: error.message || 'Cannot connect to server. Please try again later.' 
    };
  } finally {
    setLoading(false);
  }
};