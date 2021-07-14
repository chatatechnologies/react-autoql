import React from 'react'
import './Ratings.scss'

export default class Rating extends React.PureComponent {
  constructor(props) {
    super(props)
    this.state = {
      rating: this.props.rating || null,
      temp_rating: null,
    }
  }

  //onChange()

  handleMouseover(rating) {
    this.setState((prev) => ({
      rating,
      temp_rating: prev.rating,
    }))
  }

  handleMouseout() {
    this.setState((prev) => ({
      rating: prev.temp_rating,
    }))
  }

  rate(rating) {
    this.props.onSelectRating(rating) // this is the property that interacts with the parent component (sentimentAnalysis)

    // this state value us is for internal useage. It will not affect anything outside of this component
    this.setState({
      rating,
      temp_rating: rating,
    })
  }

  render() {
    let stars = []
    for (let i = 0; i < 10; i++) {
      let klass = 'ion-ios-star-outline'
      if (this.state.rating >= i && this.state.rating !== null) {
        klass = 'ion-ios-star'
      }
      stars.push(
        <i //pertaining to each star individually
          style={{
            display: 'inline-block',
            width: '20px', // <-------  These three values together work together
            minHeight: '20px', // <---  to determine the size of your star icons.
            fontSize: '46px', // <----  Feel free to play around with them.
            overflow: 'hidden',
            direction: i % 2 === 0 ? 'ltr' : 'rtl',
          }}
          className={klass}
          onMouseOver={() => this.handleMouseover(i)}
          onClick={() => this.rate(i)} // i instead of .5i
          onMouseOut={() => this.handleMouseout()}
        />
      )
    }

    return <div className="rating-style">{stars}</div> //pertaining to the container that thet stars are in
  }
}
