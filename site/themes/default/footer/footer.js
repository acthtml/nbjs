/**
 * @fileOverview <Footer />
 */
import React from 'react';

export default class Footer extend React.Component {
  constructor(props){
    super(props);
  }
  render(){
    return (
      <div className="footer">
        &copy;copyright 2016 daihua.
      </div>
    );
  }
}

