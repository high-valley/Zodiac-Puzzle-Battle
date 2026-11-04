import './style.css';
import { mountApp } from './app';
import { assetUrl, BATTLE_IMAGES, preloadImages } from './components/assets';

const root = document.getElementById('app');
if (root) mountApp(root);
// バトルに入ったときにオーブの絵が遅れて出ないように、開いたときから読み込んでおく
void preloadImages(BATTLE_IMAGES.map(assetUrl), 10000);
