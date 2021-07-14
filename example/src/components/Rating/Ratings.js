import React from "react";
import "./Ratings.scss";


export default class Rating extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      rating: this.props.rating || null,
      temp_rating: null
    };
  }

  //onChange() 

  handleMouseover(rating) {
    this.setState((prev) => ({
      rating,
      temp_rating: prev.rating
    }));
  }

  handleMouseout() {
    this.setState((prev) => ({
      rating: prev.temp_rating
    }));
  }


/* Fix this function */
  rate(rating) {
    this.setState({
      rating,
      temp_rating: rating
    });
  }

  render() {
    const { rating } = this.state;
    let stars = [];
    for (let i = 0; i < 10; i++) { 
      //console.log("i", i); //Fix logic pertaining to console...half stars*  ...all 10 values from 0 to 9 show up on the console for the og code too.
      let klass = "ion-ios-star-outline";
      if (this.state.rating >= i && this.state.rating !== null) {
        klass = "ion-ios-star";
      }
      stars.push(
        <i //pertaining to each star individually 
          style={{
            display: "inline-block",
            width: "6px",
            minHeight: "7px",
            overflow: "hidden",
            direction: i % 2 === 0 ? "ltr" : "rtl"
          }}
          className={klass}
          onMouseOver={() => this.handleMouseover(i)}
          onClick={() => this.rate(i)} // i instead of .5i 
          onMouseOut={() => this.handleMouseout()}
        />
      );
    }
    
    return <div className="rating-style">{stars}</div>; //pertaining to the container that thet stars are in
  }

}