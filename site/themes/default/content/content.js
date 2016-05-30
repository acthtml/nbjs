/**
 * @fileOverview <Footer />
 */
import React from 'react';

export default class Content extend React.Component {
  constructor(props){
    super(props);
  }
  render(){
    return (
      <div className="content">
        {this.props.content}
      </div>
    );
  }
}

