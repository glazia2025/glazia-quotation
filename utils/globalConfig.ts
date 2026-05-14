import axios from "axios";
import { QUOTATION_API_BASE_URL } from "../services/api";
import { getAuthToken } from "./auth-cookie";

export const loadGlobalConfig = () => {
  const url = `${QUOTATION_API_BASE_URL}/api/quotations/config`;
  const token = getAuthToken();
  if (token) {
    return axios.get(url, { headers: { Authorization: `Bearer ${token}` }, withCredentials: true })
      .then(res => res.data);
  }
};

export const saveGlobalConfig = (config: any) => {
  const url = `${QUOTATION_API_BASE_URL}/api/quotations/config`;
  const token = getAuthToken();
  if (token) {
    return axios.post(url, config, { headers: { Authorization: `Bearer ${token}` }, withCredentials: true });
  }
};
