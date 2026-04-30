import React, { createContext, useReducer, useEffect } from 'react';

const initialState = {
  user: null, // { mobile, name, kycGrade, issueDate }
  token: null,
  isAuthenticated: false,
  registrationStep: 0,
};

const reducer = (state, action) => {
  switch (action.type) {
    case 'SET_USER':
      localStorage.setItem('trustid_user', JSON.stringify(action.payload.user));
      localStorage.setItem('trustid_token', action.payload.token);
      return { ...state, user: action.payload.user, token: action.payload.token, isAuthenticated: true };
    case 'LOGOUT':
      localStorage.removeItem('trustid_user');
      localStorage.removeItem('trustid_token');
      return { ...state, user: null, token: null, isAuthenticated: false, registrationStep: 0 };
    case 'SET_REGISTRATION_STEP':
      return { ...state, registrationStep: action.payload };
    case 'UPDATE_USER_DATA':
      if (action.payload.token) {
        return { ...state, token: action.payload.token, user: { ...state.user, ...action.payload, token: undefined } };
      }
      return { ...state, user: { ...state.user, ...action.payload } };
    default:
      return state;
  }
};

export const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, {
    user: JSON.parse(localStorage.getItem('trustid_user') || 'null'),
    token: localStorage.getItem('trustid_token'),
    isAuthenticated: !!localStorage.getItem('trustid_token'),
    registrationStep: 0,
  });

  useEffect(() => {
    localStorage.setItem('trustid_state', JSON.stringify(state));
  }, [state]);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
};
