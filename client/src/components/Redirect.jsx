import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const Redirect = () => {
  const navigate = useNavigate();

  useEffect(() => {
    window.location.href = 'https://www.quasr.fr/'; // Redirect to the external site
  }, [navigate]);

  return null; // This component does not render anything
};

export default Redirect;