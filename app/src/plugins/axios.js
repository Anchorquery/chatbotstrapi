import axios from 'axios';
const VITE_API_URL = import.meta.env.VITE_API_URL;

//guardo axios en la ventana



axios.defaults.baseURL = VITE_API_URL;

// defino por defecto el encabezado de las peticiones 'Content-Type': 'application/x-www-form-urlencoded'

axios.defaults.headers.common['Content-Type'] = 'application/x-www-form-urlencoded';

window.axios = axios;

export default axios;



