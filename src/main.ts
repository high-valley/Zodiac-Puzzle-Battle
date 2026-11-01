import './style.css';
import { mountBattle } from './screens/battle';

const root = document.getElementById('app');
if (root) mountBattle(root);
