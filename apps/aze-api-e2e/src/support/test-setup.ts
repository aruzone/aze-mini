/* eslint-disable */
import axios from 'axios';
import { API_BASE_URL } from './api-port';

module.exports = async function () {
  // Configure axios for tests to use.
  axios.defaults.baseURL = API_BASE_URL;
};
