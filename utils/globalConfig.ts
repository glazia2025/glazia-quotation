import axios from "axios";
import { API_BASE_URL } from "../services/api";

export const loadGlobalConfig = () => {
  const url = `${API_BASE_URL}/api/quotations/config`;
  const token = localStorage.getItem("authToken");
  if (token) {
    return axios.get(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.data);
  }
};

export const saveGlobalConfig = (config: any) => {
  const url = `${API_BASE_URL}/api/quotations/config`;
  const token = localStorage.getItem("authToken");
  if (token) {
    return axios.post(url, config, { headers: { Authorization: `Bearer ${token}` } });
  }
};
