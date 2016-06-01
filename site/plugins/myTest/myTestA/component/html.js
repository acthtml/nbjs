/**
 * @fileOverview <Html />
 */
import React from 'react';
import Page from './page'

export default class Html extends React.Component {
  constructor(props){
    super(props);
  }
  render(){
    return (
      <html lang="en">
        <head>
          <meta charSet="UTF-8" />
          <title>Document</title>
        </head>
        <body>
          <div id="wrapper" className="wrapper" dangerouslySetInnerHTML={{__html:this.props.page}}>
          </div>
          <script src={this.props.scripts}></script>
        </body>
      </html>
    )
  }
}
