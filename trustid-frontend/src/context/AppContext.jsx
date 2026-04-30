import React, { createContext, useReducer, useEffect } from 'react';

const initialState = {
  user: null, // { mobile, name, kycGrade, issueDate }
  isAuthenticated: false,
  registrationStep: 0,
};

const reducer = (state, action) => {
  switch (action.type) {
    case 'SET_USER':
      return { ...state, user: action.payload, isAuthenticated: true };
    case 'LOGOUT':
      return { ...state, user: null, isAuthenticated: false, registrationStep: 0 };
    case 'SET_REGISTRATION_STEP':
      return { ...state, registrationStep: action.payload };
    case 'UPDATE_USER_DATA':
      return { ...state, user: { ...state.user, ...action.payload } };
    default:
      return state;
  }
};

export const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState, (initial) => {
    const persisted = localStorage.getItem('trustid_state');
    return persisted ? JSON.parse(persisted) : initial;
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
