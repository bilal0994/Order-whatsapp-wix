import React from 'react';
import ReactDOM from 'react-dom';
import reactToWebComponent from 'react-to-webcomponent';
import { CartOrderWhatsApp } from '../../../../shared/CartOrderWhatsApp';
import styles from './plugin.module.css';

const SideCartOrderWhatsApp = () => (
  <CartOrderWhatsApp className={styles.root} />
);

const customElement = reactToWebComponent(
  SideCartOrderWhatsApp,
  React,
  ReactDOM
);

export default customElement;
