import React, { useState, useEffect, useRef } from "react";
import dashboardclasses from "./dashboard.module.css";
import Layout from "../Components/Layout/layout";
import { Services } from "../Services";
// import CommonClasses from '../../'
import { ToastSuccess } from "../Components/utils/ToastMessage";
import { useNavigate } from "react-router";
import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";
import moment from "moment-timezone";
import { FaEnvelope, FaHashtag, FaLocationArrow, FaPhone, FaSearch, FaUser } from "react-icons/fa";
import { IoStopCircleSharp } from "react-icons/io5";
import { RiAccountPinBoxFill } from "react-icons/ri";

const center = { lat: 43.651070, lng: -79.347015 }; // Toronto, Canada

const AddManualRideBooking = () => {
    const [pickupLatLng, setPickupLatLng] = useState(null);
    const [dropLatLng, setDropLatLng] = useState(null);
    const [pickupAddress, setPickupAddress] = useState("");
    const [dropAddress, setDropAddress] = useState("");
    const [pickupSuggestions, setPickupSuggestions] = useState([]);
    const [dropSuggestions, setDropSuggestions] = useState([]);
    const [selectedPickupPlaceId, setSelectedPickupPlaceId] = useState(null);
    const [selectedDropPlaceId, setSelectedDropPlaceId] = useState(null);
    const [distance, setDistance] = useState("");
    const [duration, setDuration] = useState("");
    const [Customers, setUsers] = useState([]); // State to store users
    const [TransPortTypes, setTransPortTypes] = useState([]);
    const [transportName, setTransportName] = useState("");
    const [transportVehicleType, setTransportVehicleType] = useState("");
    const [scheduleType, setScheduleType] = useState("now"); // State to track the selected schedule type
    const navigate = useNavigate()
    const [currentVal, setCurrentVal] = useState(1)
    const [nameSearchQuery, setNameSearchQuery] = useState('');
    const [mobileSearchQuery, setMobileSearchQuery] = useState('');
    const [filteredCustomersByName, setFilteredCustomersByName] = useState([]);
    const [filteredCustomersByMobile, setFilteredCustomersByMobile] = useState([]);
    const [paymentMethod, setPaymentMethod] = useState(''); // State to manage selected payment method
    const [cashAmount, setCashAmount] = useState(''); // State for cash amount
    const [isCustomInput, setIsCustomInput] = useState(false);
    const [prepaidAmount, setPrepaidAmount] = useState(''); // State for prepaid amount
    const [selectedCustomer, setSelectedCustomer] = useState({
        mobileNumber: '',
        emailID: '',
        CustomerID: '',
        Name: '',
    });
    console.log(selectedCustomer)
    const [formData, setFormData] = useState({
        BookDate: "",
        BookTime: "",
        TransportModeID: "",
        TransportName: "",
        TransportVehicleType: "",
        PricePerKm: "",
        IsSurgePriceEnabled: false,
        Price: "",
        Distance: "",
        UserID: "",
        UserName: "",
        TimeZone: "",
    });
    const mapRef = useRef(null);
    const directionsServiceRef = useRef(null);
    const mapInstanceRef = useRef(null); // Store map instance
    const pickupMarkerRef = useRef(null); // Ref for pickup marker
    const dropMarkerRef = useRef(null); // Ref for drop marker

    const [isNewCustomer, setIsNewCustomer] = useState(false);
    const [newCustomerData, setNewCustomerData] = useState({
        CustomerName: '',
        MobileNumber: '',
        EmailID: '',
        CustomerID: ''
    });

    const [errors, setErrors] = useState({
        pickupAddress: "",
        dropAddress: "",
        BookDate: "",
        BookTime: "",
        CustomerName: "",
        MobileNumber: "",
        EmailID: "",
        CustomerID: "",
        TransportModeID: "",
        cashAmount: "",
        prepaidAmount: ""
    });

    const validateForm = () => {
        const newErrors = {};

        // Pickup Address Validation
        if (!pickupAddress.trim()) {
            newErrors.pickupAddress = "Pickup location is required.";
        }

        // Drop Address Validation
        if (!dropAddress.trim()) {
            newErrors.dropAddress = "Drop location is required.";
        }

        if (!formData.TransportModeID) {
            errors.TransportModeID = "Please select a Transport Mode.";
        }

        if (!formData.UserID) {
            errors.UserID = "Please select a Transport Mode.";
        }
        setErrors(newErrors); // Set errors in state
        return Object.keys(newErrors).length === 0; // Returns true if no errors
    };



    const token = { Authorization: `token ${localStorage.getItem("token")}` };

    useEffect(() => {
        // Fetch users on component load
        Services.getCustomersDropdown('GET', null, token)
            .then(data => {
                if (data?.Status === 1) {
                    setUsers(data.Customers); // Assuming data.Users contains the list of users
                }
            })
            .catch(error => {
                console.error("Error fetching users:", error);
            });
    }, []);

    // Function to fetch transports based on pickup and drop lat/lng
    const fetchTransports = () => {
        if (pickupLatLng && dropLatLng) {
            const transportData = {
                pickup_latitude: pickupLatLng.lat,
                pickup_longitude: pickupLatLng.lng,
                drop_latitude: dropLatLng.lat,
                drop_longitude: dropLatLng.lng,
            };

            Services.getTransports('POST', JSON.stringify(transportData), token)
                .then(data => {
                    if (data?.Status === 1) {
                        setTransPortTypes(data.Price);
                    }
                })
                .catch(error => {
                    console.error("Error fetching transports:", error);
                });
        }
    };

    useEffect(() => {
        const googleMapsScript = document.createElement("script");
        googleMapsScript.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.REACT_APP_API_KEY}&libraries=places`;

        googleMapsScript.async = true;
        window.document.body.appendChild(googleMapsScript);

        googleMapsScript.addEventListener("load", () => {
            const google = window.google;
            const map = new google.maps.Map(mapRef.current, {
                center: center,
                zoom: 10,
            });
            mapInstanceRef.current = map; // Store map instance
            directionsServiceRef.current = new google.maps.DirectionsService();
            if (pickupLatLng && dropLatLng && mapInstanceRef.current) {
                fetchTransports()
                calculateRoute(map);
            }
            // Add markers when pickup or drop location changes
            if (pickupLatLng) {
                if (pickupMarkerRef.current) {
                    pickupMarkerRef.current.setMap(null); // Remove existing marker
                }
                pickupMarkerRef.current = new google.maps.Marker({
                    position: pickupLatLng,
                    map: map,
                    title: "Pickup Location",
                });
                map.setCenter(pickupLatLng);
            }

            if (dropLatLng) {
                if (dropMarkerRef.current) {
                    dropMarkerRef.current.setMap(null); // Remove existing marker
                }
                dropMarkerRef.current = new google.maps.Marker({
                    position: dropLatLng,
                    map: map,
                    title: "Drop Location",
                });
                map.setCenter(dropLatLng);
            }
        });
    }, [pickupLatLng, dropLatLng]);

    console.log(pickupLatLng, dropLatLng)

    const calculateRoute = (map) => {
        const google = window.google;

        if (!pickupLatLng || !dropLatLng) return;

        // Center the map on the pickup location
        map.setCenter(pickupLatLng);


        const request = {
            origin: pickupLatLng,
            destination: dropLatLng,
            travelMode: google.maps.TravelMode.DRIVING,
        };

        directionsServiceRef.current.route(request, (result, status) => {
            if (status === google.maps.DirectionsStatus.OK) {
                const route = result.routes[0];
                const leg = route.legs[0];
                setDistance(leg.distance.text);
                setDuration(leg.duration.text);

                const polylinePath = [];
                route.overview_path.forEach((point) => {
                    polylinePath.push({ lat: point.lat(), lng: point.lng() });
                });

                const polyline = new google.maps.Polyline({
                    path: polylinePath,
                    geodesic: true,
                    strokeColor: "#0000FF",
                    strokeOpacity: 1.0,
                    strokeWeight: 6,
                });

                polyline.setMap(map);
            } else {
                console.error(`Error fetching directions: ${status}`);
            }
        });
    };

    const pickupTimeoutRef = useRef(null);
    const dropTimeoutRef = useRef(null);

    const handlePickupChange = (e) => {
        const value = e.target.value;
        setPickupAddress(value);

        if (errors.pickupAddress) {
            setErrors((prevErrors) => ({
                ...prevErrors,
                pickupAddress: '',
            }));
        }

        if (pickupTimeoutRef.current) {
            clearTimeout(pickupTimeoutRef.current);
        }

        pickupTimeoutRef.current = setTimeout(() => {
            if (value && value?.length > 0) {
                Services.getAutocompleteResults('GET', token, value)
                    .then(data => {
                        if (data && data.Results && data.Results.predictions) {
                            setPickupSuggestions(data.Results.predictions);
                        }
                    });
            }
        }, 1500);
    };

    const handleDropChange = (e) => {
        const value = e.target.value;
        setDropAddress(value);

        if (errors.dropAddress) {
            setErrors((prevErrors) => ({
                ...prevErrors,
                dropAddress: '',
            }));
        }

        if (dropTimeoutRef.current) {
            clearTimeout(dropTimeoutRef.current);
        }

        dropTimeoutRef.current = setTimeout(() => {
            if (value && value?.length > 0) {
                Services.getAutocompleteResults('GET', token, value)
                    .then(data => {
                        if (data && data.Results && data.Results.predictions) {
                            setDropSuggestions(data.Results.predictions);
                        }
                    });
            }
        }, 1500);
    };

    useEffect(() => {
        return () => {
            if (pickupTimeoutRef.current) {
                clearTimeout(pickupTimeoutRef.current);
            }
            if (dropTimeoutRef.current) {
                clearTimeout(dropTimeoutRef.current);
            }
        };
    }, []);

    const handlePickupSelect = (place) => {
        setPickupAddress(place.description);
        setSelectedPickupPlaceId(place.place_id);
        setPickupSuggestions([]);

        // Fetch place details based on the selected place
        Services.getPlaceInfo('GET', token, place.place_id)
            .then(placeData => {
                console.log(placeData)
                if (placeData?.Status == 1) {
                    setPickupLatLng({ lat: placeData?.Results?.result?.geometry?.location?.lat, lng: placeData?.Results?.result?.geometry?.location?.lng });
                }
            });
    };

    const handleDropSelect = (place) => {
        setDropAddress(place.description);
        setSelectedDropPlaceId(place.place_id);
        setDropSuggestions([]);

        // Fetch place details based on the selected place
        Services.getPlaceInfo('GET', token, place.place_id)
            .then(placeData => {
                if (placeData.Status == 1) {
                    setDropLatLng({ lat: placeData?.Results?.result?.geometry?.location?.lat, lng: placeData?.Results?.result?.geometry?.location?.lng });
                }
            });
    };

    const handleScheduleChange = (e) => {
        setScheduleType(e.target.value);
    };

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData({
            ...formData,
            [name]: type === "checkbox" ? checked : value,
        });

        // Update transport name and type when TransportModeID changes
        if (name === "TransportModeID") {
            // const selectedTransport = TransPortTypes.find(type => type.TransportModeID === value);
            // if (selectedTransport) {
            //   setTransportName(selectedTransport.TransportName);
            //   setTransportVehicleType(selectedTransport.TransportVehicleType);
            // }
        }
    };
    const handleNewCustomerToggle = () => {
        setIsNewCustomer(!isNewCustomer);
        if (errors.TransportModeID) {
            setErrors((prevErrors) => ({
                ...prevErrors,
                TransportModeID: '',
            }));
        }
    };

    const handleNewCustomerChange = (e) => {
        const { name, value } = e.target;
        setNewCustomerData({ ...newCustomerData, [name]: value });
    };

    const handleSubmit = (e) => {
        e.preventDefault(); // Prevent form from refreshing page
        if (!validateForm()) {
            console.log("Form has validation errors.");
            return;
        }

        if (!formData.TransportModeID) {
            alert("Please select a Transport Mode.");
            return;
        }

        // If the user selects "now", take the current date and time in the EDT timezone
        if (scheduleType === "now") {
            const currentDate = new Date();
            const timeZone = "America/New_York";
            const utcDate = fromZonedTime(new Date(), timeZone);

            let datetime = formatInTimeZone(
                utcDate,
                timeZone,
                "yyyy-MM-dd HH:MM"
            );

            console.log(datetime, "HJ")

            // Update formData with the current date and time synchronously
            setFormData((prevFormData) => ({
                ...prevFormData,

                TimeZone: timeZone // Set timezone to Canada (EDT)
            }));

            // Continue submitting the form after updating formData
            // Delay to allow the state to update before proceeding
            setTimeout(() => {
                submitBooking();
            }, 100); // Slight delay to ensure formData is updated
        } else {
            // If schedule type is not "now", submit immediately
            submitBooking();
        }
    };

    const handleNameSearch = (query) => {
        setNameSearchQuery(query);
        console.log(selectedCustomer)
        setSelectedCustomer(prev => ({ ...prev, Name: query }))
        if (query === '') {
            setFilteredCustomersByName([]);
        } else {
            const filtered = Customers.filter((customer) =>
                customer.CustomerName.toLowerCase().includes(query.toLowerCase())
            );
            setFilteredCustomersByName(filtered);
            // Check if the input is a custom value not in the list
            if (filtered.length === 0) {
                setIsCustomInput(true);
                setSelectedCustomer(prev => ({ ...prev, CustomerID: '111111' }));
            } else {
                setIsCustomInput(false);
            }
        }
    };

    const handleMobileSearch = (query) => {
        setMobileSearchQuery(query);
        setSelectedCustomer(prev => ({ ...prev, mobileNumber: query }))
        if (query === '') {
            setFilteredCustomersByMobile([]);
        } else {
            const filtered = Customers.filter((customer) =>
                customer.MobileNumber.includes(query)
            );
            setFilteredCustomersByMobile(filtered);
            // Check if the input is a custom value not in the list
            if (filtered.length === 0) {
                setIsCustomInput(true);
                setSelectedCustomer(prev => ({ ...prev, CustomerID: '111111' }));
            } else {
                setIsCustomInput(false);
            }
        }
    };

    const handleCustomerSelect = (customer) => {
        console.log(customer)
        setSelectedCustomer({
            Name: customer.CustomerName,
            mobileNumber: customer.MobileNumber,
            emailID: customer.EmailID,
            CustomerID: customer.CustomerID
        });
        setFilteredCustomersByName([]); // Clear the filtered results after selecting
        setFilteredCustomersByMobile([]); // Clear the filtered results after selecting
        setNameSearchQuery(customer.CustomerName); // Update name search query to show selected customer
        setMobileSearchQuery(customer.MobileNumber); // Update mobile search query to show selected customer
    };


    // Function to handle the final submission logic
    const submitBooking = () => {
        // Ensure TransportName and TransportVehicleType are set from the selected transport
        const selectedTransport = TransPortTypes.find(type => type.TransportModeID == formData.TransportModeID);

        const selected = Customers.find(type => type.CustomerID == selectedCustomer.CustomerID);

        // Map payment method to integer: 1 for Cash, 2 for Prepaid
        const paymentMethodInt = paymentMethod === 'cash' ? 1 : 2;

        // Determine the payment amount based on the selected method
        const PaymentAmount = paymentMethod === 'cash' ? cashAmount : prepaidAmount;

        // Automatically detect the user's timezone
        const TimeZone = "America/Toronto"

        let customerData = isNewCustomer ? newCustomerData : selectedCustomer;


        let rideData = {
            // BookDate: formData.BookDate, // Now updated with the current date and time for "now" schedule
            // BookTime: formData.BookTime, // Now updated with the current time for "now" schedule
            PickupAddress: { Address: pickupAddress, Latitude: pickupLatLng?.lat, Longitude: pickupLatLng?.lng },
            DropAddress: { Address: dropAddress, Latitude: dropLatLng?.lat, Longitude: dropLatLng?.lng },
            TransportModeID: parseInt(formData.TransportModeID),
            TransportName: selectedTransport?.TransportName,
            TransportVehicleType: selectedTransport?.TransportVehicleType,
            PricePerKm: selectedTransport?.PricePerKm,
            Distance: distance,
            UserID: parseInt(selectedCustomer.CustomerID),
            Name: selectedCustomer?.CustomerName,
            TimeZone: TimeZone,
            PaymentMethod: paymentMethodInt,
            PaymentAmount: parseFloat(PaymentAmount),
            Name: selected?.CustomerName,
            Phone: selected?.MobileNumber,
            EmailID: selected?.EmailID,

        };
        if (isNewCustomer) {
            rideData = {
                ...rideData,
                Name: customerData.CustomerName,
                Phone: customerData.MobileNumber,
                EmailID: customerData.EmailID,
                UserID: 111111,
            }
        }
        else {
            rideData = {
                ...rideData,
                Name: customerData.Name,
                Phone: customerData.mobileNumber,
                EmailID: customerData.emailID,
                UserID: customerData.CustomerID,
            }
        }
        console.log(customerData, isNewCustomer)
        console.log(rideData)
        // return
        if (scheduleType == 'now') {
            const currentDate = new Date();
            const timeZone = "America/New_York";
            // Format current date in YYYY-MM-DD format
            const bookDate = new Intl.DateTimeFormat('en-CA', {
                timeZone,
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            }).format(currentDate);

            // Format current time in HH:mm:ss format
            const bookTime = new Intl.DateTimeFormat('en-CA', {
                timeZone,
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            }).format(currentDate);
            rideData = { ...rideData, BookDate: bookDate, BookTime: bookTime }
        }
        else {
            rideData = { ...rideData, BookDate: formData.BookDate, BookTime: formData.BookTime, }

        }

        if (paymentMethod === 'cash') {
            rideData.PaymentMethod = '1';
            rideData.CashAmount = cashAmount;
        } else if (paymentMethod === 'prepaid') {
            rideData.PaymentMethod = '2';
            rideData.PrepaidAmount = prepaidAmount;
        }

        console.log(rideData)

        // Call the addBooking API
        Services.addBooking('POST', JSON.stringify(rideData), token)
            .then(response => {
                if (response?.Status === 1) {
                    navigate('/manualridebooking')
                    ToastSuccess(response.Message)
                    // alert("Booking added successfully!");
                    // Optionally, reset the form or navigate
                } else {
                    alert("Failed to add booking: " + response?.Message);
                }
            })
            .catch(error => {
                console.error("Error adding booking:", error);
                alert("An error occurred while adding the booking.");
            });
    };

    const handlePaymentMethodChange = (event) => {
        setPaymentMethod(event.target.value);
    };

    return (
        <div>
            <Layout className={dashboardclasses["dashboard-wrapper"]} Active={"ManualRideBooking"}>
                <div className={dashboardclasses.CategoryWrapper}>
                    <button
                        style={{
                            border: "none",
                            padding: "3px",
                            // margin: "10px",
                            fontSize: "20px",
                            // borderBottom: "2px solid #FE4C40",
                            borderBottom: "2px solid #C4150C",
                            // backgroundColor: '#48dbfb',
                            width: '100px',
                            borderRadius: '4px',
                        }}
                        className="back_btn"
                        onClick={() => {
                            navigate(-1);
                        }}
                    >
                        Back
                    </button>
                    <h3 className={dashboardclasses['heading-maps']}>Book Ride Manually</h3>
                    <div className={dashboardclasses['google-maps-main']}>
                        <div className={dashboardclasses['main-maps-one']}>
                            <div className={dashboardclasses['main-maps-in-one']}>
                                <h4 style={{ color: '#1874e4', fontSize: '14px' }}>Location</h4>
                                <div style={{ position: 'relative', marginBottom: '10px' }}>
                                    <FaLocationArrow style={{ position: 'absolute', top: '10px', left: '10px', fontSize: '16px', color: '#888' }} />
                                    <input
                                        id="pickup-address"
                                        type="text"
                                        placeholder="Enter pickup location"
                                        value={pickupAddress}
                                        onChange={handlePickupChange}
                                    />
                                    {errors.pickupAddress && <p style={{ color: 'red', fontSize: '12px' }}>{errors.pickupAddress}</p>}
                                </div>
                                <ul>
                                    {pickupSuggestions.map((place) => (
                                        <li key={place.place_id} onClick={() => handlePickupSelect(place)}>
                                            {place.description}
                                        </li>
                                    ))}
                                </ul>
                                <div style={{ position: 'relative' }}>
                                    <IoStopCircleSharp style={{ position: 'absolute', top: '10px', left: '10px', fontSize: '16px', color: '#888' }} />
                                    <input
                                        id="drop-address"
                                        type="text"
                                        placeholder="Enter drop location"
                                        value={dropAddress}
                                        onChange={handleDropChange}
                                    />
                                    {errors.dropAddress && <p style={{ color: 'red', fontSize: '12px' }}>{errors.dropAddress}</p>}
                                </div>
                                <ul>
                                    {dropSuggestions.map((place) => (
                                        <li key={place.place_id} onClick={() => handleDropSelect(place)}>
                                            {place.description}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <div style={{ marginTop: "2px" }}>
                                <p className={dashboardclasses['text-maps']}><span style={{ color: '#1874e4', fontSize: '15px', fontWeight: '500' }}>{distance}</span>  <span style={{ color: '#1874e4', fontSize: '15px', fontWeight: '500' }}>{duration}</span></p>
                            </div>
                            <div className={dashboardclasses["passengers-data"]}>
                                <form>
                                    <div className={dashboardclasses['radios-main']}>
                                        <label>
                                            <input
                                                type="radio"
                                                value="now"
                                                checked={scheduleType === "now"}
                                                onChange={handleScheduleChange}
                                            />
                                            Now
                                        </label>
                                        <label>
                                            <input
                                                type="radio"
                                                value="later"
                                                checked={scheduleType === "later"}
                                                onChange={handleScheduleChange}
                                            />
                                            Later
                                        </label>
                                    </div>
                                    {scheduleType === "later" && (
                                        <div className={dashboardclasses['main-select-inside-passanger']}>
                                            <div className={dashboardclasses['select-inside-passanger']}>
                                                <input
                                                    style={{ border: 'none', width: '100%' }}
                                                    type="date"
                                                    name="BookDate"
                                                    value={formData.BookDate}
                                                    onChange={handleInputChange}
                                                />
                                            </div>
                                            <div style={{ marginTop: '10px' }} className={dashboardclasses['select-inside-passanger']}>
                                                <input
                                                    style={{ border: 'none', width: '100%' }}
                                                    type="time"
                                                    name="BookTime"
                                                    value={formData.BookTime}
                                                    onChange={handleInputChange}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    <div className={dashboardclasses['inside-users-details']} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                        <select className={dashboardclasses['select-inside-passanger']} name="TransportModeID" onChange={handleInputChange} defaultValue="">
                                            <option style={{ color: 'gray' }} value="">Select Transport Mode</option>
                                            {TransPortTypes.map((type) => (
                                                <option key={type.TransportModeID} value={type.TransportModeID}>{type.TransportName}</option>
                                            ))}
                                        </select>
                                        <h4 style={{ color: '#1874e4', fontSize: '14px' }}>Passenger Details</h4>
                                        <div className={dashboardclasses['main-firstselected-details']}>
                                            <div style={{ position: 'relative', width: '48%', marginBottom: '10px' }}>
                                                {/* User Icon on the left */}
                                                <FaUser style={{ position: 'absolute', left: '1px', fontSize: '16px', color: '#5a585b', height: '35px', width: '33px', borderTopLeftRadius: '4px', borderBottomLeftRadius: '4px', backgroundColor: '#D4D9D9', padding: '9px' }} />

                                                <input
                                                    type="text"
                                                    placeholder="Name"
                                                    value={selectedCustomer.Name}
                                                    onChange={(e) => handleNameSearch(e.target.value)}
                                                    style={{
                                                        width: '100%',
                                                        padding: '5px', // Add padding to the left and right
                                                        boxSizing: 'border-box', // Ensures padding doesn't affect the width
                                                        textIndent: '10px'
                                                    }}
                                                />

                                                {/* Search Icon on the right */}
                                                <FaSearch style={{ position: 'absolute', right: '1px', fontSize: '16px', color: '#5a585b', height: '35px', width: '33px', borderTopRightRadius: '4px', borderBottomRightRadius: '4px', backgroundColor: '#D4D9D9', padding: '9px' }} />
                                            </div>

                                            {filteredCustomersByName.length > 0 && (
                                                <ul>
                                                    {filteredCustomersByName.map((customer) => (
                                                        <li
                                                            key={customer.CustomerID}
                                                            onClick={() => handleCustomerSelect(customer)}
                                                            style={{ cursor: 'pointer', padding: '5px 0' }}
                                                        >
                                                            {customer.CustomerName}
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                            <div style={{ position: 'relative', width: '48%', marginBottom: '10px' }}>
                                                <FaPhone style={{ position: 'absolute', left: '1px', fontSize: '16px', color: '#5a585b', height: '35px', width: '33px', borderTopLeftRadius: '4px', borderBottomLeftRadius: '4px', backgroundColor: '#D4D9D9', padding: '9px' }} />
                                                <input
                                                    type="text"
                                                    placeholder="Mobile Number"
                                                    value={selectedCustomer.mobileNumber}
                                                    onChange={(e) => handleMobileSearch(e.target.value)}
                                                    // style={{ width: '155px' }}
                                                    style={{
                                                        width: '100%',
                                                        padding: '5px', // Add padding to the left and right
                                                        boxSizing: 'border-box', // Ensures padding doesn't affect the width
                                                        textIndent: '10px'
                                                    }}
                                                />
                                                <FaSearch style={{ position: 'absolute', right: '1px', fontSize: '16px', color: '#5a585b', height: '35px', width: '33px', borderTopRightRadius: '4px', borderBottomRightRadius: '4px', backgroundColor: '#D4D9D9', padding: '9px' }} />
                                            </div>
                                            {filteredCustomersByMobile.length > 0 && (
                                                <ul className={dashboardclasses['main-sub-placing']}>
                                                    {filteredCustomersByMobile.map((customer) => (
                                                        <li
                                                            key={customer.CustomerID}
                                                            onClick={() => handleCustomerSelect(customer)}
                                                            style={{ cursor: 'pointer', padding: '5px 0' }}
                                                        >
                                                            {customer.MobileNumber}
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                            {/* Email Field */}
                                            <div style={{ position: 'relative', width: '48%', marginBottom: '10px' }}>
                                                <FaEnvelope style={{ position: 'absolute', left: '1px', fontSize: '16px', color: '#5a585b', height: '32px', width: '33px', borderTopLeftRadius: '4px', borderBottomLeftRadius: '4px', backgroundColor: '#D4D9D9', padding: '9px', marginTop: '1px' }} />
                                                <input
                                                    style={{ width: '100%', padding: '4px', borderRadius: '4px', border: '1px solid #CCCCCC', boxShadow: '0px 2px 5px rgba(0, 0, 0, 0.1)', paddingLeft: '45px' }}
                                                    type="email"
                                                    placeholder="Email ID"
                                                    value={selectedCustomer.emailID}
                                                    onChange={(e) =>
                                                        setSelectedCustomer({ ...selectedCustomer, emailID: e.target.value })
                                                    }
                                                />
                                            </div>
                                            {!isCustomInput && (
                                                <div style={{ position: 'relative', width: '48%', marginBottom: '10px' }}>
                                                    <RiAccountPinBoxFill style={{ position: 'absolute', left: '1px', fontSize: '16px', color: '#5a585b', height: '32px', width: '33px', borderTopLeftRadius: '4px', borderBottomLeftRadius: '4px', backgroundColor: '#D4D9D9', padding: '9px', marginTop: '1px' }} />
                                                    <input
                                                        style={{ width: '100%', padding: '4px', borderRadius: '4px', border: '1px solid #CCCCCC', boxShadow: '0px 2px 5px rgba(0, 0, 0, 0.1)', paddingLeft: '45px' }}
                                                        type="CustomerID"
                                                        placeholder="Account ID"
                                                        value={selectedCustomer.CustomerID}
                                                        onChange={(e) =>
                                                            setSelectedCustomer({ ...selectedCustomer, CustomerID: e.target.value })
                                                        }
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <h4 style={{ color: '#1874e4', fontSize: '14px' }}>Payment Methods +</h4>
                                    {isCustomInput && (
                                        <div className={dashboardclasses['radios-main']}>
                                            <label>
                                                <input
                                                    type="radio"
                                                    value="prepaid"
                                                    checked={paymentMethod === 'prepaid'}
                                                    onChange={handlePaymentMethodChange}
                                                />
                                                Prepaid
                                            </label>
                                        </div>
                                    )}
                                    {!isCustomInput && (
                                        <div className={dashboardclasses['radios-main']}>
                                            <label>
                                                <input
                                                    type="radio"
                                                    value="cash"
                                                    checked={paymentMethod === 'cash'}
                                                    onChange={handlePaymentMethodChange}
                                                />
                                                Billed
                                            </label>
                                        </div>
                                    )}
                                    {/* Conditionally show cash input */}
                                    {paymentMethod === 'cash' && (
                                        <div className={dashboardclasses['cash-amt-details']}>
                                            <label>Enter Cash Amount</label>
                                            <input
                                                type="number"
                                                placeholder="Cash Amount"
                                                value={cashAmount}
                                                onChange={(e) => setCashAmount(e.target.value)}
                                                onWheel={(e) => e.target.blur()}  // Disable scroll when focused
                                            />
                                        </div>
                                    )}

                                    {/* Conditionally show prepaid input */}
                                    {paymentMethod === 'prepaid' && (
                                        <div className={dashboardclasses['cash-amt-details']}>
                                            <label>Enter Prepaid Amount</label>
                                            <input
                                                type="number"
                                                placeholder="Prepaid Amount"
                                                value={prepaidAmount}
                                                onChange={(e) => setPrepaidAmount(e.target.value)}
                                                onWheel={(e) => e.target.blur()}  // Disable scroll when focused
                                            />
                                        </div>
                                    )}

                                    <button style={{ fontSize: '13px', fontWeight: '500' }} type="button" onClick={handleSubmit}>Confirm Booking</button>
                                </form>
                            </div>
                        </div>
                        <div className={dashboardclasses['main-maps-two']}
                            ref={mapRef}
                            style={{ width: "100%" }}
                        />
                    </div>
                </div >
            </Layout >
        </div >
    );
};

export default AddManualRideBooking;