/**
 * @fileOverview <Page />
 */
import React from 'react';
import Header from './header/header';
import Content from './content/content';
import Footer from './footer/footer';

export default class Page extends React.Component {
  constructor(props){
    super(props);
  }

  render(){
    return(
      <div className="page">
        <Header />
        <Content />
        <Footer />
      </div>
    );
  }
}
