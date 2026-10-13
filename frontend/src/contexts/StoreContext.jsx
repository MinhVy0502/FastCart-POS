import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import api from '../services/api';
import { useAuth } from './AuthContext';

const StoreContext = createContext(null);
export const useStore = () => useContext(StoreContext);

/** Thông tin cửa hàng (tên, địa chỉ, cấu hình hóa đơn, tài khoản ngân hàng). */
export const StoreProvider = ({ children }) => {
  const { user } = useAuth();
  const [settings, setSettings] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const res = await api.get('/settings');
      setSettings(res.data.data);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    if (user) refresh();
    else setSettings(null);
  }, [user, refresh]);

  return (
    <StoreContext.Provider value={{ settings, setSettings, refresh }}>
      {children}
    </StoreContext.Provider>
  );
};
