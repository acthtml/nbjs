/**
 * @fileOverview <Footer />
 */
import React from 'react';

export default class Content extends React.Component {
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

