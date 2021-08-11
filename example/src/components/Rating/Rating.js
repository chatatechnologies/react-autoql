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
    this.props.onSelectRating(rating) 

    this.setState({
      rating,
      temp_rating: rating,
    })
  }
 
  componentWillReceiveProps(nextProps) {
    if (nextProps.rating === undefined) {
      this.setState({
        rating: nextProps.rating,
        temp_rating: nextProps.rating,
      })
    }
  }

  update() {
    this.props.onClear(
      this.setState({
        rating: undefined,
      })
    )
  }

  render() {
    let stars = []
    for (let i = 0; i < 10; i++) {
      let klass = 'ion-ios-star-outline'
      if (this.state.rating >= i && this.state.rating !== null) {
        klass = 'ion-ios-star'
      }
      stars.push(
        <i
          key={i} 
          style={{
            display: 'inline-block',
            width: '20px',
            minHeight: '20px',
            fontSize: '46px',
            overflow: 'hidden',
            direction: i % 2 === 0 ? 'ltr' : 'rtl',
          }}
          className={klass}
          onMouseOver={() => this.handleMouseover(i)}
          onClick={() => {
            this.rate(i)
          }}
          onMouseOut={() => this.handleMouseout()}
        />
      )
    }

    return <div className="rating-style">{stars}</div> 
  }
}
