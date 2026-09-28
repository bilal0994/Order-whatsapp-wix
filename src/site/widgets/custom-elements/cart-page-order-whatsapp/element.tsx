import React from 'react';
import ReactDOM from 'react-dom';
import reactToWebComponent from 'react-to-webcomponent';
import { CartOrderWhatsApp } from '../../../../shared/CartOrderWhatsApp';
import styles from './element.module.css';

const CartPageOrderWhatsApp = () => (
  <CartOrderWhatsApp className={styles.root} />
);

const customElement = reactToWebComponent(
  CartPageOrderWhatsApp,
  React,
  ReactDOM
);

export default customElement;
